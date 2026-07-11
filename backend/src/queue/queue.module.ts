import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { BarsModule } from '../bars/bars.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [BarsModule, GatewayModule],
  providers: [QueueService],
  controllers: [QueueController],
  exports: [QueueService],
})
export class QueueModule {}
