import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BarsService } from '../bars/bars.service';
import { BarLinkGateway } from '../gateway/barlink.gateway';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

const EVICTION_QUEUE_NAME = 'eviction';
const AWAY_QUEUE_NAME = 'away-monitor';

@Injectable()
export class QueueService {
  private evictionQueue: Queue;
  private awayQueue: Queue;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly barsService: BarsService,
    private readonly config: ConfigService,
    private readonly gateway: BarLinkGateway,
  ) {
    const useTls = this.config.get<string>('REDIS_TLS') === 'true';
    const connection = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD'),
      ...(useTls ? { tls: {} } : {})
    };
    this.evictionQueue = new Queue(EVICTION_QUEUE_NAME, { connection });
    this.awayQueue = new Queue(AWAY_QUEUE_NAME, { connection });
  }

  async joinQueue(barId: string, userId: string, partySize: number) {
    const bar = await this.prisma.bar.findUnique({ where: { id: barId } });
    if (!bar || !bar.isActive) throw new NotFoundException('Bar not found or inactive');

    const activeAnywhere = await this.prisma.queueEntry.findFirst({
      where: {
        userId,
        status: { in: ['WAITING', 'NOTIFIED', 'INSIDE', 'AWAY'] },
      },
    });
    if (activeAnywhere) throw new BadRequestException('You already have an active queue entry at another bar');

    const existing = await this.prisma.queueEntry.findFirst({
      where: {
        userId,
        barId,
        status: { in: ['WAITING', 'NOTIFIED', 'INSIDE', 'AWAY'] },
      },
    });
    if (existing) throw new BadRequestException('Already in queue or inside this bar');

    const availableSpace = bar.maxCapacity - bar.currentCount;
    if (partySize > availableSpace && availableSpace < partySize) {
      throw new BadRequestException(
        `Not enough space. Available: ${availableSpace}, your party: ${partySize}`,
      );
    }

    const score = Date.now();
    const queueLength = await this.redis.zcard(`queue:${barId}`);
    const position = queueLength + 1;

    const qrData = uuidv4();
    const qrCodeDataUrl = await QRCode.toDataURL(qrData);

    const entry = await this.prisma.queueEntry.create({
      data: {
        userId,
        barId,
        partySize,
        position,
        status: 'WAITING',
        qrCode: qrData,
      },
    });

    await this.redis.zadd(`queue:${barId}`, score, entry.id);
    await this.redis.set(`qr:${qrData}`, entry.id);
    await this.redis.set(
      `entry:${entry.id}`,
      JSON.stringify({ ...entry, qrCodeDataUrl }),
    );

    return { ...entry, qrCodeDataUrl, position };
  }

  async getQueueState(barId: string) {
    const entries = await this.redis.zrangeWithScores(`queue:${barId}`, 0, -1);
    const detailed = await Promise.all(
      entries.map(async ({ member, score }, idx) => {
        const raw = await this.redis.get(`entry:${member}`);
        const entry = raw ? JSON.parse(raw) : null;
        return { ...entry, position: idx + 1, score };
      }),
    );
    return detailed;
  }

  async admitPatron(qrCode: string, staffBarId: string) {
    const entryId = await this.redis.get(`qr:${qrCode}`);
    if (!entryId) throw new NotFoundException('QR code not found');

    const entry = await this.prisma.queueEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundException('Queue entry not found');
    if (entry.barId !== staffBarId) throw new BadRequestException('QR code for wrong bar');
    if (entry.status !== 'WAITING' && entry.status !== 'NOTIFIED') {
      throw new BadRequestException(`Cannot admit patron with status: ${entry.status}`);
    }

    const updated = await this.prisma.queueEntry.update({
      where: { id: entryId },
      data: { status: 'INSIDE', admittedAt: new Date() },
    });

    await this.redis.zrem(`queue:${staffBarId}`, entryId);
    await this.barsService.updateCapacity(staffBarId, entry.partySize);
    await this.recalculatePositions(staffBarId);

    await this.prisma.analyticsEvent.create({
      data: { barId: staffBarId, userId: entry.userId, eventType: 'PATRON_ADMITTED' },
    });

    return updated;
  }

  async markAway(entryId: string) {
    const entry = await this.prisma.queueEntry.findUnique({ where: { id: entryId } });
    if (!entry || entry.status !== 'INSIDE') {
      throw new BadRequestException('Entry must be INSIDE to mark AWAY');
    }

    const awayJobId = `away-${entryId}-${Date.now()}`;
    await this.awayQueue.add(
      'check-away',
      { entryId, barId: entry.barId, userId: entry.userId, partySize: entry.partySize },
      {
        jobId: awayJobId,
        delay: 15 * 60 * 1000,
      },
    );

    return this.prisma.queueEntry.update({
      where: { id: entryId },
      data: {
        status: 'AWAY',
        awayStartedAt: new Date(),
        gracePeriodEnds: new Date(Date.now() + 15 * 60 * 1000),
        awayJobId,
      },
    });
  }

  async markExit(entryId: string) {
    const entry = await this.prisma.queueEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundException('Entry not found');

    const updated = await this.prisma.queueEntry.update({
      where: { id: entryId },
      data: { status: 'EXITED', exitedAt: new Date() },
    });

    if (entry.status === 'INSIDE' || entry.status === 'AWAY') {
      await this.barsService.updateCapacity(entry.barId, -entry.partySize);
    }

    this.gateway.emitChatBlocked(entry.userId, entry.barId);

    await this.prisma.analyticsEvent.create({
      data: { barId: entry.barId, userId: entry.userId, eventType: 'PATRON_EXITED' },
    });

    return updated;
  }

  async bouncerOverride(entryId: string, action: 'reinstate' | 'evict') {
    const entry = await this.prisma.queueEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundException('Entry not found');

    if (action === 'reinstate') {
      return this.prisma.queueEntry.update({
        where: { id: entryId },
        data: { status: 'INSIDE', awayStartedAt: null, gracePeriodEnds: null },
      });
    } else {
      return this.markExit(entryId);
    }
  }

  async scheduleEvictionCheck(entryId: string, barId: string) {
    const jobId = `evict-${entryId}`;
    await this.evictionQueue.add(
      'evict',
      { entryId, barId },
      { jobId, delay: 20 * 60 * 1000 },
    );

    return this.prisma.queueEntry.update({
      where: { id: entryId },
      data: { evictionJobId: jobId, status: 'NOTIFIED' },
    });
  }

  async updateLastSeen(entryId: string, lat: number, lon: number) {
    return this.prisma.queueEntry.update({
      where: { id: entryId },
      data: { lastSeenAt: new Date() },
    });
  }

  async getEntryByUser(userId: string, barId: string) {
    return this.prisma.queueEntry.findFirst({
      where: { userId, barId, status: { in: ['WAITING', 'NOTIFIED', 'INSIDE', 'AWAY'] } },
    });
  }

  async simulateCheckIn(barId: string) {
    const bar = await this.prisma.bar.findUnique({ where: { id: barId } });
    if (!bar || !bar.isActive) throw new NotFoundException('Bar not found or inactive');
    if (bar.currentCount >= bar.maxCapacity) {
      throw new BadRequestException('Bar is at capacity');
    }

    const id = uuidv4();
    const gender = Math.random() < 0.5 ? 'male' : 'female';
    const age = Math.floor(Math.random() * 23) + 18;
    const partySize = Math.floor(Math.random() * 4) + 1;
    const names = [
      'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery',
      'Sam', 'Jamie', 'Cameron', 'Dakota', 'Reese', 'Skyler', 'Peyton', 'Sawyer',
    ];
    const displayName = `${names[Math.floor(Math.random() * names.length)]} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}.`;
    const email = `sim-${id.slice(0, 8)}@barlink.com`;

    const user = await this.prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash: await bcrypt.hash(uuidv4(), 10),
        role: 'PATRON' as any,
      },
    });

    await this.prisma.profile.create({
      data: {
        userId: user.id,
        gender,
        age,
        bio: 'Here for the vibes.',
        photoUrl: `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`,
        openToChat: true,
      },
    });

    const qrData = uuidv4();
    const qrCodeDataUrl = await QRCode.toDataURL(qrData);

    const entry = await this.prisma.queueEntry.create({
      data: {
        userId: user.id,
        barId,
        partySize,
        position: 0,
        status: 'INSIDE',
        qrCode: qrData,
        admittedAt: new Date(),
      },
    });

    await this.barsService.updateCapacity(barId, partySize);

    await this.prisma.analyticsEvent.create({
      data: { barId, userId: user.id, eventType: 'PATRON_ADMITTED' },
    });

    this.gateway.emitCapacityUpdate(barId, { currentCount: bar.currentCount + partySize });

    return { ...entry, qrCodeDataUrl, userId: user.id, displayName };
  }

  private async recalculatePositions(barId: string) {
    const entries = await this.redis.zrange(`queue:${barId}`, 0, -1);
    await Promise.all(
      entries.map(async (entryId, idx) => {
        await this.prisma.queueEntry.update({
          where: { id: entryId },
          data: { position: idx + 1 },
        });
      }),
    );
  }
}
