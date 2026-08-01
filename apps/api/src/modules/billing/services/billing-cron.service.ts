import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { UsageLimitService } from './usage-limit.service';
import { RenewalService } from './renewal.service';

@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usageLimit: UsageLimitService,
    private readonly renewal: RenewalService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async expireTrials() {
    const now = new Date();
    const tenants = await this.prisma.tenant.findMany({
      where: {
        status: 'active',
        trialEndsAt: { lt: now },
      },
      include: {
        subscriptions: {
          where: { status: { in: ['trialing', 'active'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    for (const tenant of tenants) {
      const sub = tenant.subscriptions[0];
      const hasPaidSub =
        sub?.status === 'active' &&
        (!sub.currentPeriodEnd || sub.currentPeriodEnd > now);

      if (hasPaidSub) continue;

      await this.prisma.$transaction(async (tx) => {
        await tx.tenant.update({
          where: { id: tenant.id },
          data: { status: 'trial_expired' },
        });

        if (sub?.status === 'trialing') {
          await tx.subscription.update({
            where: { id: sub.id },
            data: { status: 'canceled' },
          });
        }
      });

      this.logger.log(`Trial expired for tenant ${tenant.id}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async syncUsageCounters() {
    await this.usageLimit.syncDirtyCountersToPostgres();
  }

  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async renewSubscriptions() {
    await this.renewal.renewSubscriptionsExpiringWithin(3);
  }
}
