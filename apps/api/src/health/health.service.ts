import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const APP_VERSION = process.env.APP_VERSION ?? '0.1.0';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  getHealth() {
    return {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
    };
  }

  async getDbHealth() {
    const base = this.getHealth();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ...base, database: 'connected' as const };
    } catch {
      return { ...base, status: 'error' as const, database: 'disconnected' as const };
    }
  }

  async getRedisHealth() {
    const base = this.getHealth();
    const connected = await this.redis.ping();
    return {
      ...base,
      status: connected ? ('ok' as const) : ('error' as const),
      redis: connected ? ('connected' as const) : ('disconnected' as const),
    };
  }
}
