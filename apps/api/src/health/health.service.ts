import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ReleaseService } from '../modules/release/release.service';

@Injectable()
export class HealthService {
  private readonly appVersion: string;
  private readonly sprintNumber: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    config: ConfigService,
    private readonly release: ReleaseService,
  ) {
    this.appVersion = config.get<string>('APP_VERSION', '0.1.0');
    this.sprintNumber = Number(config.get<string>('SPRINT_NUMBER', '0'));
  }

  getHealth() {
    const current = this.release.getCurrent();
    return {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      version: current.version || this.appVersion,
      sprint: current.sprint || this.sprintNumber,
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
