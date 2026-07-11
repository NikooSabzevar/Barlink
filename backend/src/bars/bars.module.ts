import { Module } from '@nestjs/common';
import { BarsService } from './bars.service';
import { BarsController } from './bars.controller';

@Module({
  providers: [BarsService],
  controllers: [BarsController],
  exports: [BarsService],
})
export class BarsModule {}
