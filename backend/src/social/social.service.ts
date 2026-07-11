import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BarLinkGateway } from '../gateway/barlink.gateway';

@Injectable()
export class SocialService {
  constructor(
    private prisma: PrismaService,
    private gateway: BarLinkGateway,
  ) {}

  async getProfile(userId: string) {
    return this.prisma.profile.findUnique({ where: { userId } });
  }

  async upsertProfile(
    userId: string,
    data: { photoUrl?: string; bio?: string; gender?: string; age?: number; openToChat?: boolean },
  ) {
    return this.prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async getLoungeUsers(barId: string) {
    const insideEntries = await this.prisma.queueEntry.findMany({
      where: { barId, status: 'INSIDE' },
      select: { userId: true },
    });
    const userIds = insideEntries.map((e) => e.userId);

    return this.prisma.user.findMany({
      where: { id: { in: userIds }, profile: { openToChat: true } },
      select: {
        id: true,
        displayName: true,
        profile: { select: { photoUrl: true, bio: true, gender: true, age: true } },
      },
    });
  }

  private async assertInsideBar(senderId: string, barId: string) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { userId: senderId, barId, status: 'INSIDE' },
    });
    if (!entry) {
      throw new ForbiddenException(
        'You must be checked in and inside the venue to send messages.',
      );
    }
  }

  async sendMessage(senderId: string, barId: string, receiverId: string, body: string) {
    await this.assertInsideBar(senderId, barId);

    const receiver = await this.prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) throw new NotFoundException('Recipient not found.');

    const message = await this.prisma.message.create({
      data: { senderId, receiverId, barId, body },
      include: {
        sender: { select: { id: true, displayName: true } },
      },
    });

    this.gateway.emitChatMessage(receiverId, message);
    return message;
  }

  async getThread(userId: string, otherUserId: string, barId: string) {
    return this.prisma.message.findMany({
      where: {
        barId,
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, displayName: true } },
      },
    });
  }

  async getInbox(userId: string) {
    const messages = await this.prisma.message.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, displayName: true } },
        receiver: { select: { id: true, displayName: true } },
      },
    });

    const threadMap = new Map<string, any>();
    for (const m of messages) {
      const otherId = m.senderId === userId ? m.receiverId : m.senderId;
      if (!threadMap.has(otherId)) threadMap.set(otherId, m);
    }
    return Array.from(threadMap.values());
  }

  async blockChatOnExit(userId: string, barId: string) {
    await this.gateway.emitChatBlocked(userId, barId);
  }
}
