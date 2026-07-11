import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BarsService } from './bars.service';

@Controller('bars')
export class BarsController {
  constructor(private readonly barsService: BarsService) {}

  @Get()
  findAll() {
    return this.barsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.barsService.findOne(id);
  }

  @Get(':id/demographics')
  getDemographics(@Param('id') id: string) {
    return this.barsService.getDemographicsHistory(id);
  }

  @Get(':id/velocity')
  @UseGuards(AuthGuard('jwt'))
  getVelocity(@Param('id') id: string) {
    return this.barsService.getRollingVelocity(id);
  }

  @Get(':id/social-stats')
  getSocialStats(@Param('id') id: string) {
    return this.barsService.getInsideSocialStats(id);
  }
}
