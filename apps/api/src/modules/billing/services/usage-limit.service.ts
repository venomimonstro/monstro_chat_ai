import {
  Injectable,
  Logger,
  OnModuleInit,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { EmailService } from '../../../common/email/email.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { TariffResolverService } from './tariff-resolver.service';
import {
  TrialExpiredException,
  UsageLimitExceededException,
  TenantSuspendedException,
} from '../billing.errors';
import type { UsageDto } from '@ai-consultant/shared-types';

const USAGE_THRESHOLDS = [80, 95, 100] as const;

@Injectable()
export class UsageLimitService implements OnModuleInit {
  private readonly logger = new Logger(UsageLimitService.name);
  private readonly dirtyTenants = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    private readonly tariffResolver: TariffResolverService,
  ) {}

  async onModuleInit() {
    await this.hydrateRedisFromPostgres();
  }

  getPeriodKey(date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private redisKey(tenantId: string, periodKey: string) {
    return `usage:${tenantId}:${periodKey}`;
  }

  async hydrateRedisFromPostgres() {
    const periodKey = this.getPeriodKey();
    const counters = await this.prisma.usageCounter.findMany({
      where: { periodKey },
    });

    const client = this.redis.getClient();
    if (!client) {
      this.logger.warn('Redis unavailable — usage counters will use Postgres only');
      return;
    }

    for (const counter of counters) {
      const key = this.redisKey(counter.tenantId, periodKey);
      const existing = await client.get(key);
      const redisVal = existing ? parseInt(existing, 10) : 0;
      const dbVal = counter.messageCount;
      const merged = Math.max(redisVal, dbVal);
      await client.set(key, String(merged));
      if (merged > dbVal) {
        await this.prisma.usageCounter.update({
          where: { id: counter.id },
          data: { messageCount: merged },
        });
      }
    }

    this.logger.log(
      `Hydrated ${counters.length} usage counters for period ${periodKey}`,
    );
  }

  async getUsage(tenantId: string): Promise<UsageDto> {
    const tariff = await this.tariffResolver.getEffectiveTariff(tenantId);
    const limit = tariff?.messageLimit ?? 500;
    const periodKey = this.getPeriodKey();
    const used = await this.getCurrentCount(tenantId, periodKey);

    return {
      periodKey,
      used,
      limit,
      percent: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0,
      overagePolicy: tariff?.overagePolicy ?? 'block',
    };
  }

  async assertCanCreateDialog(tenantId: string) {
    await this.assertTenantAccess(tenantId);
  }

  async assertCanSendMessage(tenantId: string) {
    await this.assertTenantAccess(tenantId);

    const tariff = await this.tariffResolver.getEffectiveTariff(tenantId);
    const limit = tariff?.messageLimit ?? 500;
    const periodKey = this.getPeriodKey();
    const used = await this.getCurrentCount(tenantId, periodKey);

    if (used < limit) return;

    const policy = tariff?.overagePolicy ?? 'block';

    if (policy === 'allow') return;

    if (policy === 'charge') {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      const unitCost =
        tariff && tariff.messageLimit > 0
          ? Number(tariff.price) / tariff.messageLimit
          : 0;
      const balance = Number(tenant?.balance ?? 0);
      if (balance >= unitCost) return;
      throw new UsageLimitExceededException(used, limit);
    }

    throw new UsageLimitExceededException(used, limit);
  }

  async recordMessage(tenantId: string): Promise<number> {
    const periodKey = this.getPeriodKey();
    const client = this.redis.getClient();
    let used: number;

    if (client) {
      const key = this.redisKey(tenantId, periodKey);
      used = await client.incr(key);
    } else {
      const counter = await this.prisma.usageCounter.upsert({
        where: { tenantId_periodKey: { tenantId, periodKey } },
        create: { tenantId, periodKey, messageCount: 1 },
        update: { messageCount: { increment: 1 } },
      });
      used = counter.messageCount;
    }

    this.dirtyTenants.add(`${tenantId}:${periodKey}`);
    await this.checkThresholdNotifications(tenantId, periodKey, used);

    return used;
  }

  async chargeOverage(tenantId: string, used: number) {
    const tariff = await this.tariffResolver.getEffectiveTariff(tenantId);
    const limit = tariff?.messageLimit ?? 500;
    if (
      tariff?.overagePolicy === 'charge' &&
      used > limit &&
      tariff.messageLimit > 0
    ) {
      const unitCost = Number(tariff.price) / tariff.messageLimit;
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { balance: { decrement: unitCost } },
      });
    }
  }

  async syncDirtyCountersToPostgres() {
    if (!this.dirtyTenants.size) return;

    const entries = [...this.dirtyTenants];
    this.dirtyTenants.clear();
    const client = this.redis.getClient();

    for (const entry of entries) {
      const [tenantId, periodKey] = entry.split(':');
      let count = 0;

      if (client) {
        const val = await client.get(this.redisKey(tenantId, periodKey));
        count = val ? parseInt(val, 10) : 0;
      }

      await this.prisma.usageCounter.upsert({
        where: { tenantId_periodKey: { tenantId, periodKey } },
        create: { tenantId, periodKey, messageCount: count },
        update: { messageCount: count },
      });
    }
  }

  async checkThresholdNotifications(
    tenantId: string,
    periodKey: string,
    used: number,
  ) {
    const tariff = await this.tariffResolver.getEffectiveTariff(tenantId);
    const limit = tariff?.messageLimit ?? 500;
    if (limit <= 0) return;

    const percent = (used / limit) * 100;

    for (const threshold of USAGE_THRESHOLDS) {
      if (percent < threshold) continue;

      const alreadySent = await this.prisma.usageNotification.findUnique({
        where: { tenantId_periodKey_threshold: { tenantId, periodKey, threshold } },
      });
      if (alreadySent) continue;

      try {
        await this.prisma.usageNotification.create({
          data: { tenantId, periodKey, threshold },
        });
      } catch {
        continue;
      }

      const owner = await this.prisma.user.findFirst({
        where: { tenantId, role: 'client' },
        orderBy: { createdAt: 'asc' },
      });
      if (owner) {
        await this.email.sendUsageThreshold(
          owner.email,
          threshold,
          used,
          limit,
        );
      }

      void this.notifications
        .create({
          tenantId,
          type: 'usage.threshold',
          title: `Использовано ${threshold}% лимита`,
          body: `Отправлено ${used} из ${limit} сообщений в этом месяце.`,
          metadata: { threshold, used, limit, periodKey },
        })
        .catch((err) => {
          this.logger.warn(`Usage in-app notification failed: ${String(err)}`);
        });

      this.logger.log(
        `Usage ${threshold}% notification sent for tenant ${tenantId}`,
      );
    }
  }

  private async assertTenantAccess(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new ForbiddenException('Тенант не найден');
    }

    if (tenant.status === 'suspended') {
      throw new TenantSuspendedException();
    }

    if (tenant.status === 'trial_expired') {
      throw new TrialExpiredException();
    }

    const activeSub = await this.tariffResolver.getActiveSubscription(tenantId);
    if (activeSub) return;

    if (tenant.trialEndsAt && tenant.trialEndsAt > new Date()) return;

    throw new TrialExpiredException();
  }

  private async getCurrentCount(
    tenantId: string,
    periodKey: string,
  ): Promise<number> {
    const client = this.redis.getClient();
    if (client) {
      const val = await client.get(this.redisKey(tenantId, periodKey));
      if (val !== null) return parseInt(val, 10);
    }

    const counter = await this.prisma.usageCounter.findUnique({
      where: { tenantId_periodKey: { tenantId, periodKey } },
    });
    return counter?.messageCount ?? 0;
  }
}
