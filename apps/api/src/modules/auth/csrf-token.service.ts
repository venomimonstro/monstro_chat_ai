import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

const CSRF_PREFIX = 'csrf:';
const CSRF_TTL_SECONDS = 30 * 24 * 60 * 60;

@Injectable()
export class CsrfTokenService {
  constructor(private readonly redis: RedisService) {}

  async bind(refreshTokenId: string, token: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client || !refreshTokenId || !token) return;
    await client.setex(`${CSRF_PREFIX}${refreshTokenId}`, CSRF_TTL_SECONDS, token);
  }

  async validate(refreshTokenId: string, token: string): Promise<boolean> {
    const client = this.redis.getClient();
    if (!client || !refreshTokenId || !token) return false;
    const stored = await client.get(`${CSRF_PREFIX}${refreshTokenId}`);
    return stored === token;
  }

  async clear(refreshTokenId: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client || !refreshTokenId) return;
    await client.del(`${CSRF_PREFIX}${refreshTokenId}`);
  }
}
