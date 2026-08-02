import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { RedisService } from '../../../redis/redis.service';

@Injectable()
export class AnalyticsCacheService {
  private readonly ttlSec: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.ttlSec = config.get<number>('ANALYTICS_CACHE_TTL_SEC', 600);
  }

  private key(payload: unknown) {
    const hash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    return `analytics:cache:${hash}`;
  }

  async get<T>(payload: unknown): Promise<T | null> {
    const client = this.redis.getClient();
    if (!client) return null;
    const raw = await client.get(this.key(payload));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async set(payload: unknown, value: unknown) {
    const client = this.redis.getClient();
    if (!client) return;
    await client.setex(this.key(payload), this.ttlSec, JSON.stringify(value));
  }

  private tenantVersionKey(tenantId: string) {
    return `analytics:tenant-ver:${tenantId}`;
  }

  async getTenantVersion(tenantId: string): Promise<number> {
    const client = this.redis.getClient();
    if (!client) return 0;
    const raw = await client.get(this.tenantVersionKey(tenantId));
    return raw ? Number(raw) || 0 : 0;
  }

  async invalidateTenant(tenantId: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;
    await client.incr(this.tenantVersionKey(tenantId));
  }
}
