import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Queue, Job } from 'bullmq';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class AwayMonitorWorker implements OnModuleInit {
  private readonly logger = new Logger(AwayMonitorWorker.name);
  private worker: Worker;
  private awayQueue: Queue;

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

    this.awayQueue = new Queue('away-monitor', { connection });

    this.worker = new Worker(
      'away-monitor',
      async (job: Job) => {
        const { entryId, barId, userId, partySize } = job.data;
        this.logger.log(`Away check for entry ${entryId}`);

        const stage = job.data.stage ?? 1;

        if (stage === 1) {
          this.logger.log(`Stage 1 (15min): Send "Coming back?" push notification to ${userId}`);
          await this.awayQueue.add(
            'check-away',
            { entryId, barId, userId, partySize, stage: 2 },
            {
              jobId: `away-${entryId}-stage2`,
              delay: 5 * 60 * 1000,
            },
          );
        } else if (stage === 2) {
          this.logger.log(`Stage 2 (20min): No response received, final warning`);
          await this.awayQueue.add(
            'check-away',
            { entryId, barId, userId, partySize, stage: 3 },
            {
              jobId: `away-${entryId}-stage3`,
              delay: 10 * 60 * 1000,
            },
          );
        } else if (stage === 3) {
          this.logger.log(`Stage 3 (30min): Auto-exit for entry ${entryId}`);
          try {
            await this.queueService.markExit(entryId);
            this.logger.log(`Auto-exited ${entryId} after 30-minute away period`);
          } catch (err) {
            this.logger.warn(`Auto-exit failed for ${entryId}: ${err.message}`);
          }
        }
      },
      { connection },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Away monitor job ${job.id} stage ${job.data.stage} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Away monitor job ${job?.id} failed: ${err.message}`);
    });
  }
}
