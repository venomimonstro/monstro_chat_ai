import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../redis/redis.service';
import {
  WIDGET_RATE_LIMIT_MAX,
  WIDGET_RATE_LIMIT_WINDOW_MS,
} from '../constants';

@Injectable()
export class WidgetRateLimitService {
  private readonly max: number;
  private readonly windowMs: number;
  private readonly logger = new Logger(WidgetRateLimitService.name);
  private readonly inMemory = new Map<string, number[]>();

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.max = config.get<number>('WIDGET_RATE_LIMIT_MAX', WIDGET_RATE_LIMIT_MAX);
    this.windowMs = config.get<number>(
      'WIDGET_RATE_LIMIT_WINDOW_MS',
      WIDGET_RATE_LIMIT_WINDOW_MS,
    );
  }

  async checkLimit(visitorId: string): Promise<{
    allowed: boolean;
    remaining: number;
  }> {
    const client = this.redis.getClient();
    if (client) {
      return this.checkRedisLimit(client, visitorId);
    }

    this.logger.warn('Redis unavailable — falling back to in-memory widget rate limit');
    return this.checkMemoryLimit(visitorId);
  }

  private async checkRedisLimit(
    client: import('ioredis').default,
    visitorId: string,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const key = `rate:widget:${visitorId}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    await client.zremrangebyscore(key, 0, windowStart);
    const count = await client.zcard(key);

    if (count >= this.max) {
      return { allowed: false, remaining: 0 };
    }

    await client.zadd(key, now, `${now}:${Math.random()}`);
    await client.expire(key, Math.ceil(this.windowMs / 1000) + 1);

    return { allowed: true, remaining: this.max - count - 1 };
  }

  private checkMemoryLimit(visitorId: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = this.inMemory.get(visitorId) ?? [];
    const valid = timestamps.filter((t) => t > windowStart);

    if (valid.length >= this.max) {
      this.inMemory.set(visitorId, valid);
      return { allowed: false, remaining: 0 };
    }

    valid.push(now);
    this.inMemory.set(visitorId, valid);
    return { allowed: true, remaining: this.max - valid.length };
  }
}
