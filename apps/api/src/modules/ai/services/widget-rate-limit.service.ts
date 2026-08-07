import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../../redis/redis.service';
import {
  WIDGET_DUPLICATE_MAX,
  WIDGET_DUPLICATE_WINDOW_MS,
  WIDGET_IP_RATE_LIMIT_MAX,
  WIDGET_JOIN_RATE_LIMIT_MAX,
  WIDGET_RATE_LIMIT_MAX,
  WIDGET_RATE_LIMIT_WINDOW_MS,
} from '../constants';

export interface RateLimitOptions {
  visitorMax?: number;
  ipMax?: number;
}

@Injectable()
export class WidgetRateLimitService {
  private readonly defaultMax: number;
  private readonly ipMax: number;
  private readonly windowMs: number;
  private readonly logger = new Logger(WidgetRateLimitService.name);
  private readonly inMemory = new Map<string, number[]>();

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.defaultMax = config.get<number>('WIDGET_RATE_LIMIT_MAX', WIDGET_RATE_LIMIT_MAX);
    this.ipMax = config.get<number>('WIDGET_IP_RATE_LIMIT_MAX', WIDGET_IP_RATE_LIMIT_MAX);
    this.windowMs = config.get<number>(
      'WIDGET_RATE_LIMIT_WINDOW_MS',
      WIDGET_RATE_LIMIT_WINDOW_MS,
    );
  }

  async checkLimit(
    visitorId: string,
    ip?: string | null,
    options?: RateLimitOptions,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    reason?: 'visitor' | 'ip' | 'duplicate';
  }> {
    const visitorMax = options?.visitorMax ?? this.defaultMax;
    const ipLimit = options?.ipMax ?? this.ipMax;

    const visitor = await this.checkKey(`rate:widget:v:${visitorId}`, visitorMax);
    if (!visitor.allowed) {
      return { allowed: false, remaining: 0, reason: 'visitor' };
    }

    if (ip) {
      const ipResult = await this.checkKey(`rate:widget:ip:${ip}`, ipLimit);
      if (!ipResult.allowed) {
        return { allowed: false, remaining: 0, reason: 'ip' };
      }
    }

    return { allowed: true, remaining: visitor.remaining };
  }

  async checkJoinLimit(visitorId: string, ip?: string | null): Promise<boolean> {
    const visitor = await this.checkKey(
      `rate:widget:join:v:${visitorId}`,
      WIDGET_JOIN_RATE_LIMIT_MAX,
    );
    if (!visitor.allowed) return false;
    if (ip && this.isDistinctClientIp(ip)) {
      const ipResult = await this.checkKey(
        `rate:widget:join:ip:${ip}`,
        WIDGET_JOIN_RATE_LIMIT_MAX * 2,
      );
      if (!ipResult.allowed) return false;
    }
    return true;
  }

  /** Skip shared proxy loopback — all visitors would share one bucket otherwise. */
  private isDistinctClientIp(ip: string): boolean {
    const normalized = ip.trim().toLowerCase();
    if (!normalized || normalized === 'unknown') return false;
    if (
      normalized === '127.0.0.1' ||
      normalized === '::1' ||
      normalized === '::ffff:127.0.0.1'
    ) {
      return false;
    }
    return true;
  }

  async checkDuplicate(
    visitorId: string,
    content: string,
  ): Promise<boolean> {
    const normalized = content.trim().toLowerCase().slice(0, 500);
    if (!normalized) return true;

    const client = this.redis.getClient();
    const key = `rate:widget:dup:${visitorId}:${this.hash(normalized)}`;

    if (client) {
      const count = await client.incr(key);
      if (count === 1) {
        await client.pexpire(key, WIDGET_DUPLICATE_WINDOW_MS);
      }
      return count <= WIDGET_DUPLICATE_MAX;
    }

    return this.checkMemoryLimit(key).allowed;
  }

  private async checkKey(
    key: string,
    max: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const client = this.redis.getClient();
    if (client) {
      return this.checkRedisLimit(client, key, max);
    }

    this.logger.warn('Redis unavailable — falling back to in-memory widget rate limit');
    return this.checkMemoryLimit(key, max);
  }

  private async checkRedisLimit(
    client: import('ioredis').default,
    key: string,
    max: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    await client.zremrangebyscore(key, 0, windowStart);
    const count = await client.zcard(key);

    if (count >= max) {
      return { allowed: false, remaining: 0 };
    }

    await client.zadd(key, now, `${now}:${Math.random()}`);
    await client.expire(key, Math.ceil(this.windowMs / 1000) + 1);

    return { allowed: true, remaining: max - count - 1 };
  }

  private checkMemoryLimit(
    key: string,
    max = this.defaultMax,
  ): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = this.inMemory.get(key) ?? [];
    const valid = timestamps.filter((t) => t > windowStart);

    if (valid.length >= max) {
      this.inMemory.set(key, valid);
      return { allowed: false, remaining: 0 };
    }

    valid.push(now);
    this.inMemory.set(key, valid);
    return { allowed: true, remaining: max - valid.length };
  }

  private hash(text: string): string {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = (h << 5) - h + text.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  }
}
