import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TariffResolverService } from './tariff-resolver.service';
import { TariffsService } from './tariffs.service';
import type { BillingOverviewDto } from '@ai-consultant/shared-types';
import { UsageLimitService } from './usage-limit.service';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tariffResolver: TariffResolverService,
    private readonly tariffsService: TariffsService,
    private readonly usageLimit: UsageLimitService,
  ) {}

  async getOverview(tenantId: string): Promise<BillingOverviewDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const subscription = await this.tariffResolver.getActiveSubscription(
      tenantId,
    );
    const usage = await this.usageLimit.getUsage(tenantId);

    let trialDaysLeft: number | null = null;
    if (tenant.trialEndsAt) {
      const ms = tenant.trialEndsAt.getTime() - Date.now();
      trialDaysLeft = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }

    return {
      tenantStatus: tenant.status,
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      trialDaysLeft,
      balance: Number(tenant.balance),
      subscription: subscription
        ? {
            id: subscription.id,
            tariffId: subscription.tariffId,
            status: subscription.status,
            currentPeriodEnd:
              subscription.currentPeriodEnd?.toISOString() ?? null,
            tariff: this.tariffsService.toDto(subscription.tariff),
          }
        : null,
      usage,
    };
  }
}
