import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DealsService } from './deals.service';

@Controller('deals')
export class DealsController {
  constructor(private deals: DealsService) {}

  @Get(':barId/active')
  getActive(@Param('barId') barId: string) {
    return this.deals.getActiveDeals(barId);
  }

  @Get(':barId')
  getAll(@Param('barId') barId: string) {
    return this.deals.getAllDeals(barId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':barId')
  create(
    @Param('barId') barId: string,
    @Body() body: { title: string; description: string; startsAt: string; endsAt: string },
  ) {
    return this.deals.createDeal(barId, {
      ...body,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<{ title: string; description: string; startsAt: string; endsAt: string; isActive: boolean }>,
  ) {
    const data: any = { ...body };
    if (body.startsAt) data.startsAt = new Date(body.startsAt);
    if (body.endsAt) data.endsAt = new Date(body.endsAt);
    return this.deals.updateDeal(id, data);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.deals.deleteDeal(id);
  }
}
