import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../redis/redis.service';
import { CRM_SYNC_LOCK_TTL_SEC } from '../constants';

export type CrmSyncOrigin = 'internal' | 'external';

@Injectable()
export class CrmSyncLockService {
  constructor(private readonly redis: RedisService) {}

  private key(leadId: string) {
    return `crm:sync:lock:${leadId}`;
  }

  async acquire(leadId: string, origin: CrmSyncOrigin): Promise<boolean> {
    const client = this.redis.getClient();
    if (!client) return true;
    const result = await client.set(
      this.key(leadId),
      origin,
      'EX',
      CRM_SYNC_LOCK_TTL_SEC,
      'NX',
    );
    return result === 'OK';
  }

  async refresh(leadId: string, origin: CrmSyncOrigin) {
    const client = this.redis.getClient();
    if (!client) return;
    await client.set(this.key(leadId), origin, 'EX', CRM_SYNC_LOCK_TTL_SEC);
  }

  async getOrigin(leadId: string): Promise<CrmSyncOrigin | null> {
    const client = this.redis.getClient();
    if (!client) return null;
    const value = await client.get(this.key(leadId));
    if (value === 'internal' || value === 'external') return value;
    return null;
  }

  async release(leadId: string) {
    const client = this.redis.getClient();
    if (!client) return;
    await client.del(this.key(leadId));
  }
}
