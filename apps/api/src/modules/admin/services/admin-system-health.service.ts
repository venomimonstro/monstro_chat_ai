import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { QUEUE_SYSTEM_UPDATES } from '../constants';
import { QUEUE_CRM_EXPORT, QUEUE_CRM_STATUS_SYNC, QUEUE_LEAD_DELIVERY } from '../../integrations/constants';
import { QUEUE_CRAWL_SITE, QUEUE_INGEST_DOCUMENT } from '../../knowledge/constants';

export interface QueueHealthDto {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
}

export interface AdminSystemHealthDto {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  postgres: 'connected' | 'disconnected';
  redis: 'connected' | 'disconnected';
  queues: QueueHealthDto[];
}

@Injectable()
export class AdminSystemHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue(QUEUE_SYSTEM_UPDATES) private readonly systemUpdatesQueue: Queue,
    @InjectQueue(QUEUE_CRM_EXPORT) private readonly crmExportQueue: Queue,
    @InjectQueue(QUEUE_CRM_STATUS_SYNC) private readonly crmStatusQueue: Queue,
    @InjectQueue(QUEUE_LEAD_DELIVERY) private readonly leadDeliveryQueue: Queue,
    @InjectQueue(QUEUE_CRAWL_SITE) private readonly crawlQueue: Queue,
    @InjectQueue(QUEUE_INGEST_DOCUMENT) private readonly ingestQueue: Queue,
  ) {}

  async getHealth(): Promise<AdminSystemHealthDto> {
    const [postgresOk, redisOk, queues] = await Promise.all([
      this.checkPostgres(),
      this.redis.ping(),
      this.getQueueStats(),
    ]);

    const status =
      postgresOk && redisOk ? 'ok' : postgresOk || redisOk ? 'degraded' : 'error';

    return {
      status,
      timestamp: new Date().toISOString(),
      postgres: postgresOk ? 'connected' : 'disconnected',
      redis: redisOk ? 'connected' : 'disconnected',
      queues,
    };
  }

  private async checkPostgres(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async getQueueStats(): Promise<QueueHealthDto[]> {
    const queues = [
      { name: QUEUE_SYSTEM_UPDATES, queue: this.systemUpdatesQueue },
      { name: QUEUE_CRM_EXPORT, queue: this.crmExportQueue },
      { name: QUEUE_CRM_STATUS_SYNC, queue: this.crmStatusQueue },
      { name: QUEUE_LEAD_DELIVERY, queue: this.leadDeliveryQueue },
      { name: QUEUE_CRAWL_SITE, queue: this.crawlQueue },
      { name: QUEUE_INGEST_DOCUMENT, queue: this.ingestQueue },
    ];

    const stats = await Promise.all(
      queues.map(async ({ name, queue }) => {
        try {
          const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'delayed',
            'failed',
          );
          return {
            name,
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            delayed: counts.delayed ?? 0,
            failed: counts.failed ?? 0,
          };
        } catch {
          return { name, waiting: 0, active: 0, delayed: 0, failed: 0 };
        }
      }),
    );

    return stats;
  }
}
