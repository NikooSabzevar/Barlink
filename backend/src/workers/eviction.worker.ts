import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class EvictionWorker implements OnModuleInit {
  private readonly logger = new Logger(EvictionWorker.name);
  private worker: Worker;

  constructor(
    private readonly queueService: QueueService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const useTls = this.config.get<string>('REDIS_TLS') === 'true';
    const connection = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6379),
      password: this.config.get<string>('REDIS_PASSWORD'),
      ...(useTls ? { tls: {} } : {})
    };

    this.worker = new Worker(
      'eviction',
      async (job: Job) => {
        const { entryId, barId } = job.data;
        this.logger.log(`Eviction check for entry ${entryId} at bar ${barId}`);
        try {
          const entry = await this.queueService.getEntryByUser('', barId);
          await this.queueService.markExit(entryId);
          this.logger.log(`Evicted entry ${entryId} after 20-minute eviction window`);
        } catch (err) {
          this.logger.warn(`Eviction failed for ${entryId}: ${err.message}`);
        }
      },
      { connection },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Eviction job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Eviction job ${job?.id} failed: ${err.message}`);
    });
  }
}
