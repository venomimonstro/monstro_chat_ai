import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { RedisService } from '../../../redis/redis.service';

const REDIS_KEY = 'admin:diagnostics-token';

@Injectable()
export class DiagnosticsTokenService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async getToken(): Promise<string> {
    const client = this.redis.getClient();
    if (!client) {
      return this.fallbackToken();
    }
    const existing = await client.get(REDIS_KEY);
    if (existing) return existing;
    return this.regenerate();
  }

  async regenerate(): Promise<string> {
    const token = randomBytes(24).toString('base64url');
    const client = this.redis.getClient();
    if (client) {
      await client.set(REDIS_KEY, token);
    }
    return token;
  }

  async validate(token: string): Promise<boolean> {
    if (!token?.trim()) return false;
    const client = this.redis.getClient();
    if (!client) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        return false;
      }
      return token === this.fallbackToken();
    }
    const stored = await client.get(REDIS_KEY);
    return stored === token;
  }

  buildPublicUrls(token: string) {
    const publicSite = this.config.get<string>(
      'PUBLIC_SITE_URL',
      'http://localhost:4321',
    ).replace(/\/$/, '');
    const apiPublic = this.config.get<string>(
      'API_PUBLIC_URL',
      'http://localhost:3000/api',
    ).replace(/\/$/, '');

    return {
      pageUrl: `${publicSite}/diag/${token}`,
      apiUrl: `${apiPublic}/public/diagnostics/${token}`,
    };
  }

  private fallbackToken(): string {
    return this.config.get<string>('DIAGNOSTICS_FALLBACK_TOKEN', 'dev-diagnostics');
  }
}
