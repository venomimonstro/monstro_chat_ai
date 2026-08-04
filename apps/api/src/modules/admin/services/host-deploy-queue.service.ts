import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../redis/redis.service';

const REDIS_KEY = 'release:host-job';

export type HostDeployJobType = 'deploy' | 'rollback';

export interface HostDeployJob {
  type: HostDeployJobType;
  updateId?: string;
  version: string;
  sprint: number;
  rollbackTarget?: string;
  queuedAt: string;
}

@Injectable()
export class HostDeployQueueService {
  private readonly logger = new Logger(HostDeployQueueService.name);
  private memoryJob: HostDeployJob | null = null;

  constructor(private readonly redis: RedisService) {}

  async queueJob(job: Omit<HostDeployJob, 'queuedAt'>): Promise<HostDeployJob> {
    const payload: HostDeployJob = {
      ...job,
      queuedAt: new Date().toISOString(),
    };
    const client = this.redis.getClient();
    if (client) {
      await client.set(REDIS_KEY, JSON.stringify(payload));
    } else {
      this.memoryJob = payload;
      this.logger.warn('Redis unavailable — host job kept in memory');
    }
    return payload;
  }

  async claimJob(): Promise<HostDeployJob | null> {
    const client = this.redis.getClient();
    if (client) {
      const raw = await client.getdel(REDIS_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as HostDeployJob;
      } catch {
        this.logger.warn('Failed to parse host deploy job from Redis');
        return null;
      }
    }
    const job = this.memoryJob;
    this.memoryJob = null;
    return job;
  }

  async peekJob(): Promise<HostDeployJob | null> {
    const client = this.redis.getClient();
    if (client) {
      const raw = await client.get(REDIS_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as HostDeployJob;
      } catch {
        return null;
      }
    }
    return this.memoryJob;
  }
}
