import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { SemanticCacheService } from '../../ai/services/semantic-cache.service';
import type { TenantMarginDto } from '@ai-consultant/shared-types';

@Injectable()
export class MarginAnalyticsService {
  private readonly usdRubRate: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly semanticCache: SemanticCacheService,
    config: ConfigService,
  ) {
    this.usdRubRate = config.get<number>('USD_RUB_RATE', 90);
  }

  async getTenantMargin(
    tenantId: string,
    from?: Date,
    to?: Date,
  ): Promise<TenantMarginDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const periodFrom = from ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const periodTo = to ?? new Date();

    const [revenueAgg, llmAgg, cacheHits] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          tenantId,
          type: { in: ['payment', 'subscription_renewal'] },
          createdAt: { gte: periodFrom, lte: periodTo },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.lLMUsageLog.aggregate({
        where: {
          tenantId,
          createdAt: { gte: periodFrom, lte: periodTo },
        },
        _sum: { costUsd: true },
        _count: true,
      }),
      this.semanticCache.getHitCount(tenantId, periodFrom, periodTo),
    ]);

    const revenueRub = Number(revenueAgg._sum.amount ?? 0);
    const llmCostUsd = Number(llmAgg._sum.costUsd ?? 0);
    const llmCostRub = llmCostUsd * this.usdRubRate;
    const marginRub = revenueRub - llmCostRub;
    const marginPercent =
      revenueRub > 0 ? Math.round((marginRub / revenueRub) * 100) : 0;

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      periodFrom: periodFrom.toISOString(),
      periodTo: periodTo.toISOString(),
      revenueRub,
      llmCostUsd,
      llmCostRub,
      marginRub,
      marginPercent,
      transactionCount: revenueAgg._count,
      llmCallCount: llmAgg._count,
      cacheHitCount: cacheHits,
    };
  }
}
