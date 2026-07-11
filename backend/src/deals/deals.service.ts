import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DealsService {
  constructor(private prisma: PrismaService) {}

  async getActiveDeals(barId: string) {
    const now = new Date();
    return this.prisma.deal.findMany({
      where: {
        barId,
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async getAllDeals(barId: string) {
    return this.prisma.deal.findMany({
      where: { barId },
      orderBy: { startsAt: 'desc' },
    });
  }

  async createDeal(
    barId: string,
    data: { title: string; description: string; startsAt: Date; endsAt: Date },
  ) {
    return this.prisma.deal.create({ data: { barId, ...data } });
  }

  async updateDeal(id: string, data: Partial<{ title: string; description: string; startsAt: Date; endsAt: Date; isActive: boolean }>) {
    const deal = await this.prisma.deal.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException('Deal not found.');
    return this.prisma.deal.update({ where: { id }, data });
  }

  async deleteDeal(id: string) {
    return this.prisma.deal.delete({ where: { id } });
  }
}
