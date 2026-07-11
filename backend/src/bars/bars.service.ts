import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class BarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll() {
    const bars = await this.prisma.bar.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return Promise.all(
      bars.map(async (bar) => {
        const queueLength = await this.redis.zcard(`queue:${bar.id}`);
        const occupancyPct = Math.round((bar.currentCount / bar.maxCapacity) * 100);
        const estimatedWaitMins = Math.ceil(queueLength * 8);
        return { ...bar, queueLength, occupancyPct, estimatedWaitMins };
      }),
    );
  }

  async findOne(barId: string) {
    const bar = await this.prisma.bar.findUnique({ where: { id: barId } });
    if (!bar) throw new NotFoundException('Bar not found');

    const queueLength = await this.redis.zcard(`queue:${barId}`);
    const queueEntries = await this.redis.zrangeWithScores(`queue:${barId}`, 0, -1);
    const occupancyPct = Math.round((bar.currentCount / bar.maxCapacity) * 100);
    const estimatedWaitMins = Math.ceil(queueLength * 8);

    const latestDemographics = await this.prisma.demographics.findFirst({
      where: { barId },
      orderBy: { timestamp: 'desc' },
    });

    return {
      ...bar,
      queueLength,
      queueEntries,
      occupancyPct,
      estimatedWaitMins,
      demographics: latestDemographics,
    };
  }

  async updateCapacity(barId: string, delta: number) {
    const bar = await this.prisma.bar.findUnique({ where: { id: barId } });
    if (!bar) throw new NotFoundException('Bar not found');
    const newCount = Math.max(0, Math.min(bar.maxCapacity, bar.currentCount + delta));
    return this.prisma.bar.update({
      where: { id: barId },
      data: { currentCount: newCount },
    });
  }

  async getRollingVelocity(barId: string): Promise<number> {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const entries = await this.prisma.analyticsEvent.count({
      where: {
        barId,
        eventType: 'PATRON_ADMITTED',
        createdAt: { gte: thirtyMinAgo },
      },
    });
    return Math.round(entries / 30);
  }

  async getDemographicsHistory(barId: string) {
    return this.prisma.demographics.findMany({
      where: { barId },
      orderBy: { timestamp: 'desc' },
      take: 48,
    });
  }

  async getInsideSocialStats(barId: string) {
    const insideEntries = await this.prisma.queueEntry.findMany({
      where: { barId, status: 'INSIDE' },
      include: {
        user: {
          select: {
            profile: { select: { gender: true, age: true } },
          },
        },
      },
    });

    const profiles = insideEntries
      .map((e) => e.user?.profile)
      .filter(Boolean) as { gender: string | null; age: number | null }[];

    const total = insideEntries.length;
    const withProfile = profiles.length;

    const genderCounts = profiles.reduce(
      (acc, p) => {
        const g = (p.gender ?? 'unknown').toLowerCase();
        if (g === 'male') acc.male += 1;
        else if (g === 'female') acc.female += 1;
        else acc.other += 1;
        return acc;
      },
      { male: 0, female: 0, other: 0 },
    );

    const groupSizes = insideEntries.reduce(
      (acc, e) => {
        const size = e.partySize;
        if (size === 1) acc.solo += 1;
        else if (size === 2) acc.pairs += 1;
        else if (size === 3) acc.trios += 1;
        else acc.groups += 1;
        acc.people += size;
        return acc;
      },
      { solo: 0, pairs: 0, trios: 0, groups: 0, people: 0 },
    );

    const ageBuckets = {
      '18-21': 0,
      '22-25': 0,
      '26-29': 0,
      '30-34': 0,
      '35-39': 0,
      '40+': 0,
      unknown: 0,
    };

    for (const p of profiles) {
      if (!p.age || p.age < 18) {
        ageBuckets.unknown += 1;
      } else if (p.age <= 21) {
        ageBuckets['18-21'] += 1;
      } else if (p.age <= 25) {
        ageBuckets['22-25'] += 1;
      } else if (p.age <= 29) {
        ageBuckets['26-29'] += 1;
      } else if (p.age <= 34) {
        ageBuckets['30-34'] += 1;
      } else if (p.age <= 39) {
        ageBuckets['35-39'] += 1;
      } else {
        ageBuckets['40+'] += 1;
      }
    }

    return {
      total,
      withProfile,
      people: groupSizes.people,
      genderRatio: {
        male: genderCounts.male,
        female: genderCounts.female,
        other: genderCounts.other,
        malePct: withProfile ? Math.round((genderCounts.male / withProfile) * 100) : 0,
        femalePct: withProfile ? Math.round((genderCounts.female / withProfile) * 100) : 0,
      },
      groupSizes,
      ageBuckets,
    };
  }
}
