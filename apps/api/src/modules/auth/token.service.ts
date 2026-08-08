import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { randomUUID } from 'crypto';

const REFRESH_PREFIX = 'refresh:';
const BLACKLIST_PREFIX = 'refresh:blacklist:';
const LOGIN_ATTEMPTS_PREFIX = 'login:attempts:';
const TWO_FA_ATTEMPTS_PREFIX = '2fa:attempts:';
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const LOGIN_WINDOW_SECONDS = 15 * 60; // 15 min
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_TWO_FA_ATTEMPTS = 5;

export interface RefreshTokenData {
  userId: string;
  tenantId: string | null;
  tokenId: string;
  twoFaVerified?: boolean;
  sessionVersion?: number;
}

@Injectable()
export class TokenService {
  constructor(private readonly redis: RedisService) {}

  async storeRefreshToken(data: RefreshTokenData): Promise<string> {
    const client = this.redis.getClient();
    const tokenId = data.tokenId || randomUUID();
    if (!client) return tokenId;

    await client.setex(
      `${REFRESH_PREFIX}${tokenId}`,
      REFRESH_TTL_SECONDS,
      JSON.stringify({
        userId: data.userId,
        tenantId: data.tenantId,
        twoFaVerified: data.twoFaVerified,
        sessionVersion: data.sessionVersion,
      }),
    );
    return tokenId;
  }

  async validateRefreshToken(tokenId: string): Promise<RefreshTokenData | null> {
    const client = this.redis.getClient();
    if (!client) return null;

    const isBlacklisted = await client.exists(
      `${BLACKLIST_PREFIX}${tokenId}`,
    );
    if (isBlacklisted) return null;

    const raw = await client.get(`${REFRESH_PREFIX}${tokenId}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      userId: string;
      tenantId: string | null;
      twoFaVerified?: boolean;
      sessionVersion?: number;
    };
    return { ...parsed, tokenId };
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;

    await client.del(`${REFRESH_PREFIX}${tokenId}`);
    await client.setex(
      `${BLACKLIST_PREFIX}${tokenId}`,
      REFRESH_TTL_SECONDS,
      '1',
    );
  }

  async checkLoginRateLimit(email: string): Promise<{
    allowed: boolean;
    retryAfterSeconds?: number;
  }> {
    return this.peekLoginRateLimit(email);
  }

  async peekLoginRateLimit(email: string): Promise<{
    allowed: boolean;
    retryAfterSeconds?: number;
  }> {
    const client = this.redis.getClient();
    if (!client) return { allowed: true };

    const key = `${LOGIN_ATTEMPTS_PREFIX}${email.toLowerCase()}`;
    const raw = await client.get(key);
    const attempts = raw ? parseInt(raw, 10) : 0;

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      const ttl = await client.ttl(key);
      return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : LOGIN_WINDOW_SECONDS };
    }
    return { allowed: true };
  }

  private async incrementLoginAttempts(email: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;

    const key = `${LOGIN_ATTEMPTS_PREFIX}${email.toLowerCase()}`;
    const attempts = await client.incr(key);
    if (attempts === 1) {
      await client.expire(key, LOGIN_WINDOW_SECONDS);
    }
  }

  async resetLoginAttempts(email: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;
    await client.del(`${LOGIN_ATTEMPTS_PREFIX}${email.toLowerCase()}`);
  }

  async recordLoginFailure(email: string): Promise<void> {
    await this.incrementLoginAttempts(email);
  }

  async checkTwoFaRateLimit(userId: string): Promise<{
    allowed: boolean;
    retryAfterSeconds?: number;
  }> {
    const client = this.redis.getClient();
    if (!client) return { allowed: true };

    const key = `${TWO_FA_ATTEMPTS_PREFIX}${userId}`;
    const raw = await client.get(key);
    const attempts = raw ? parseInt(raw, 10) : 0;

    if (attempts >= MAX_TWO_FA_ATTEMPTS) {
      const ttl = await client.ttl(key);
      return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : LOGIN_WINDOW_SECONDS };
    }
    return { allowed: true };
  }

  async recordTwoFaFailure(userId: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;

    const key = `${TWO_FA_ATTEMPTS_PREFIX}${userId}`;
    const attempts = await client.incr(key);
    if (attempts === 1) {
      await client.expire(key, LOGIN_WINDOW_SECONDS);
    }
  }

  async resetTwoFaAttempts(userId: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;
    await client.del(`${TWO_FA_ATTEMPTS_PREFIX}${userId}`);
  }
}
