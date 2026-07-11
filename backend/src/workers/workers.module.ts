import { Module } from '@nestjs/common';
import { EvictionWorker } from './eviction.worker';
import { AwayMonitorWorker } from './away-monitor.worker';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  providers: [EvictionWorker, AwayMonitorWorker],
})
export class WorkersModule {}
