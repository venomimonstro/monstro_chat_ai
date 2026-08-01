import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { Tariff, Subscription } from '@prisma/client';

@Injectable()
export class TariffResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async getEffectiveTariff(tenantId: string): Promise<Tariff | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tariff: true,
        subscriptions: {
          where: { status: { in: ['trialing', 'active'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { tariff: true },
        },
      },
    });

    if (!tenant) return null;

    const subscription = tenant.subscriptions[0];
    if (subscription?.tariff) {
      return subscription.tariff;
    }

    if (tenant.tariff) {
      return tenant.tariff;
    }

    return this.prisma.tariff.findFirst({
      where: { name: 'Start', isActive: true },
    });
  }

  async getActiveSubscription(
    tenantId: string,
  ): Promise<(Subscription & { tariff: Tariff }) | null> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['trialing', 'active'] },
      },
      orderBy: { createdAt: 'desc' },
      include: { tariff: true },
    });

    if (!subscription) return null;

    if (
      subscription.currentPeriodEnd &&
      subscription.currentPeriodEnd < new Date() &&
      subscription.status === 'trialing'
    ) {
      return null;
    }

    return subscription;
  }
}
