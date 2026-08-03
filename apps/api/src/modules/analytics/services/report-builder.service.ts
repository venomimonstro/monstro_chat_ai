import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type {
  AnalyticsDimension,
  AnalyticsMetric,
  AnalyticsQueryRequest,
  AnalyticsQueryResponse,
  AnalyticsSeriesPoint,
  PlatformAnalyticsSummaryDto,
  TenantStatisticsDto,
} from '@ai-consultant/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnalyticsCacheService } from './analytics-cache.service';

interface DateRange {
  from: Date;
  to: Date;
}

const DEAL_WON_STATUS_NAMES = ['Продажа', 'Закрыт', 'Успешно', 'Won', 'Closed Won'];

@Injectable()
export class ReportBuilderService {
  private readonly usdRubRate: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AnalyticsCacheService,
    config: ConfigService,
  ) {
    this.usdRubRate = config.get<number>('USD_RUB_RATE', 90);
  }

  async query(input: AnalyticsQueryRequest): Promise<AnalyticsQueryResponse> {
    const cached = await this.cache.get<AnalyticsQueryResponse>(input);
    if (cached) return { ...cached, cached: true };

    const range = this.parseRange(input.from, input.to);
    const series = await this.buildSeries(input, range);
    const total = series.reduce((sum, row) => sum + row.value, 0);
    const result: AnalyticsQueryResponse = {
      metric: input.metric,
      dimension: input.dimension,
      from: input.from,
      to: input.to,
      series,
      total,
      cached: false,
    };
    await this.cache.set(input, result);
    return result;
  }

  async getTenantStatistics(
    tenantId: string,
    from: string,
    to: string,
  ): Promise<TenantStatisticsDto> {
    const version = await this.cache.getTenantVersion(tenantId);
    const cacheKey = { type: 'tenant-stats', tenantId, from, to, version };
    const cached = await this.cache.get<TenantStatisticsDto>(cacheKey);
    if (cached) return cached;

    const range = this.parseRange(from, to);
    const where = {
      tenantId,
      createdAt: { gte: range.from, lte: range.to },
    };

    const [dialogs, leads, messages, dialogsByDay, leadsByDay, wonLeads] =
      await Promise.all([
        this.prisma.dialog.count({ where }),
        this.prisma.lead.count({ where: { ...where, archived: false } }),
        this.prisma.message.count({ where }),
        this.countDialogsByDay(tenantId, range),
        this.countLeadsByDay(tenantId, range),
        this.countWonLeads(tenantId, range),
      ]);

    const conversionRate =
      dialogs > 0 ? Math.round((leads / dialogs) * 1000) / 10 : 0;

    const result: TenantStatisticsDto = {
      from,
      to,
      dialogs,
      leads,
      messages,
      conversionRate,
      funnel: [
        { stage: 'Диалоги', count: dialogs },
        { stage: 'Лиды', count: leads },
        { stage: 'Сделки', count: wonLeads },
      ],
      dialogsByDay: this.fillDaySeries(dialogsByDay, range),
      leadsByDay: this.fillDaySeries(leadsByDay, range),
    };

    await this.cache.set(cacheKey, result);
    return result;
  }

  async getPlatformSummary(
    from: string,
    to: string,
  ): Promise<PlatformAnalyticsSummaryDto> {
    const cacheKey = { type: 'platform-summary', from, to };
    const cached = await this.cache.get<PlatformAnalyticsSummaryDto>(cacheKey);
    if (cached) return cached;

    const range = this.parseRange(from, to);

    const [
      revenueAgg,
      llmAgg,
      dialogs,
      leads,
      activeTenants,
      topTenants,
      tokenAgg,
    ] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          type: { in: ['payment', 'subscription_renewal'] },
          createdAt: { gte: range.from, lte: range.to },
        },
        _sum: { amount: true },
      }),
      this.prisma.lLMUsageLog.aggregate({
        where: { createdAt: { gte: range.from, lte: range.to } },
        _sum: { costUsd: true },
        _count: true,
      }),
      this.prisma.dialog.count({
        where: { createdAt: { gte: range.from, lte: range.to } },
      }),
      this.prisma.lead.count({
        where: {
          archived: false,
          createdAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.tenant.count({
        where: {
          status: 'active',
          dialogs: {
            some: { createdAt: { gte: range.from, lte: range.to } },
          },
        },
      }),
      this.prisma.$queryRaw<
        Array<{
          tenant_id: string;
          tenant_name: string;
          llm_cost: Prisma.Decimal;
          llm_calls: bigint;
        }>
      >`
        SELECT tn.id as tenant_id,
               tn.name as tenant_name,
               COALESCE(SUM(l.cost_usd), 0) as llm_cost,
               COUNT(l.id)::bigint as llm_calls
        FROM tenants tn
        LEFT JOIN llm_usage_logs l
          ON l.tenant_id = tn.id
         AND l.created_at >= ${range.from}
         AND l.created_at <= ${range.to}
        GROUP BY tn.id, tn.name
        HAVING COUNT(l.id) > 0
        ORDER BY llm_cost DESC
        LIMIT 8
      `,
      this.prisma.$queryRaw<Array<{ tokens: bigint }>>`
        SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0)::bigint as tokens
        FROM llm_usage_logs
        WHERE created_at >= ${range.from}
          AND created_at <= ${range.to}
      `,
    ]);

    const revenueRub = Number(revenueAgg._sum.amount ?? 0);
    const llmCostUsd = Number(llmAgg._sum.costUsd ?? 0);
    const llmCostRub = llmCostUsd * this.usdRubRate;
    const marginRub = revenueRub - llmCostRub;

    const result: PlatformAnalyticsSummaryDto = {
      from,
      to,
      revenueRub,
      llmCostUsd,
      llmCostRub,
      marginRub,
      marginPercent:
        revenueRub > 0 ? Math.round((marginRub / revenueRub) * 100) : 0,
      llmCalls: llmAgg._count,
      llmTokens: Number(tokenAgg[0]?.tokens ?? 0),
      dialogs,
      leads,
      activeTenants,
      topTenantsByCost: topTenants.map((row) => ({
        tenantId: row.tenant_id,
        tenantName: row.tenant_name,
        llmCostUsd: Number(row.llm_cost),
        llmCalls: Number(row.llm_calls),
      })),
    };

    await this.cache.set(cacheKey, result);
    return result;
  }

  private async buildSeries(
    input: AnalyticsQueryRequest,
    range: DateRange,
  ): Promise<AnalyticsSeriesPoint[]> {
    switch (input.metric) {
      case 'mrr':
        return this.queryMrr(input, range);
      case 'dialogs':
        return this.queryDialogs(input, range);
      case 'leads':
        return this.queryLeads(input, range);
      case 'conversion':
        return this.queryConversion(input, range);
      case 'llm_cost':
      case 'llm_tokens':
      case 'llm_calls':
        return this.queryLlmUsage(input, range);
      default:
        return [];
    }
  }

  private async queryLlmUsage(
    input: AnalyticsQueryRequest,
    range: DateRange,
  ): Promise<AnalyticsSeriesPoint[]> {
    const tenantFilter = input.tenantId
      ? Prisma.sql`AND l.tenant_id = ${input.tenantId}::uuid`
      : Prisma.empty;

    if (input.dimension === 'tenant') {
      const valueExpr =
        input.metric === 'llm_cost'
          ? Prisma.sql`SUM(l.cost_usd)`
          : input.metric === 'llm_tokens'
            ? Prisma.sql`SUM(l.prompt_tokens + l.completion_tokens)`
            : Prisma.sql`COUNT(*)::bigint`;

      const rows = await this.prisma.$queryRaw<
        Array<{ label: string; value: Prisma.Decimal | bigint }>
      >`
        SELECT tn.name as label, ${valueExpr} as value
        FROM llm_usage_logs l
        JOIN tenants tn ON tn.id = l.tenant_id
        WHERE l.created_at >= ${range.from}
          AND l.created_at <= ${range.to}
          ${tenantFilter}
        GROUP BY tn.name
        ORDER BY value DESC
        LIMIT 20
      `;
      return rows.map((row) => ({
        label: row.label,
        value: Number(row.value),
      }));
    }

    if (input.dimension === 'provider') {
      const valueExpr =
        input.metric === 'llm_cost'
          ? Prisma.sql`SUM(l.cost_usd)`
          : input.metric === 'llm_tokens'
            ? Prisma.sql`SUM(l.prompt_tokens + l.completion_tokens)`
            : Prisma.sql`COUNT(*)::bigint`;

      const rows = await this.prisma.$queryRaw<
        Array<{ label: string; value: Prisma.Decimal | bigint }>
      >`
        SELECT COALESCE(l.provider, 'unknown') as label, ${valueExpr} as value
        FROM llm_usage_logs l
        WHERE l.created_at >= ${range.from}
          AND l.created_at <= ${range.to}
          ${tenantFilter}
        GROUP BY l.provider
        ORDER BY value DESC
      `;
      return rows.map((row) => ({
        label: row.label,
        value: Number(row.value),
      }));
    }

    const valueExpr =
      input.metric === 'llm_cost'
        ? Prisma.sql`SUM(l.cost_usd)`
        : input.metric === 'llm_tokens'
          ? Prisma.sql`SUM(l.prompt_tokens + l.completion_tokens)`
          : Prisma.sql`COUNT(*)::bigint`;

    const rows = await this.prisma.$queryRaw<
      Array<{ label: string; value: Prisma.Decimal | bigint }>
    >`
      SELECT to_char(date_trunc('day', l.created_at), 'YYYY-MM-DD') as label,
             ${valueExpr} as value
      FROM llm_usage_logs l
      WHERE l.created_at >= ${range.from}
        AND l.created_at <= ${range.to}
        ${tenantFilter}
      GROUP BY 1
      ORDER BY 1
    `;

    return this.fillDaySeries(
      rows.map((row) => ({ label: row.label, value: Number(row.value) })),
      range,
    );
  }

  private async queryMrr(
    input: AnalyticsQueryRequest,
    range: DateRange,
  ): Promise<AnalyticsSeriesPoint[]> {
    if (input.dimension === 'tariff') {
      const rows = await this.prisma.$queryRaw<
        Array<{ label: string; value: Prisma.Decimal }>
      >`
        SELECT COALESCE(tf.name, 'Без тарифа') as label,
               SUM(t.amount) as value
        FROM transactions t
        JOIN tenants tn ON tn.id = t.tenant_id
        LEFT JOIN tariffs tf ON tf.id = tn.tariff_id
        WHERE t.type IN ('payment', 'subscription_renewal')
          AND t.created_at >= ${range.from}
          AND t.created_at <= ${range.to}
          ${input.tenantId ? Prisma.sql`AND t.tenant_id = ${input.tenantId}::uuid` : Prisma.empty}
        GROUP BY tf.name
        ORDER BY value DESC
      `;
      return rows.map((row) => ({
        label: row.label,
        value: Number(row.value),
      }));
    }

    const rows = await this.prisma.$queryRaw<
      Array<{ label: string; value: Prisma.Decimal }>
    >`
      SELECT to_char(date_trunc('month', t.created_at), 'YYYY-MM') as label,
             SUM(t.amount) as value
      FROM transactions t
      WHERE t.type IN ('payment', 'subscription_renewal')
        AND t.created_at >= ${range.from}
        AND t.created_at <= ${range.to}
        ${input.tenantId ? Prisma.sql`AND t.tenant_id = ${input.tenantId}::uuid` : Prisma.empty}
      GROUP BY 1
      ORDER BY 1
    `;
    return rows.map((row) => ({ label: row.label, value: Number(row.value) }));
  }

  private async queryDialogs(
    input: AnalyticsQueryRequest,
    range: DateRange,
  ): Promise<AnalyticsSeriesPoint[]> {
    if (input.dimension === 'source') {
      const rows = await this.prisma.$queryRaw<
        Array<{ label: string; value: bigint }>
      >`
        SELECT COALESCE(s.name, 'Без источника') as label, COUNT(*)::bigint as value
        FROM dialogs d
        LEFT JOIN sources s ON s.id = d.source_id
        WHERE d.created_at >= ${range.from}
          AND d.created_at <= ${range.to}
          ${input.tenantId ? Prisma.sql`AND d.tenant_id = ${input.tenantId}::uuid` : Prisma.empty}
        GROUP BY s.name
        ORDER BY value DESC
      `;
      return rows.map((row) => ({
        label: row.label,
        value: Number(row.value),
      }));
    }

    if (input.dimension === 'tenant') {
      const rows = await this.prisma.$queryRaw<
        Array<{ label: string; value: bigint }>
      >`
        SELECT tn.name as label, COUNT(*)::bigint as value
        FROM dialogs d
        JOIN tenants tn ON tn.id = d.tenant_id
        WHERE d.created_at >= ${range.from}
          AND d.created_at <= ${range.to}
        GROUP BY tn.name
        ORDER BY value DESC
        LIMIT 20
      `;
      return rows.map((row) => ({
        label: row.label,
        value: Number(row.value),
      }));
    }

    return this.fillDaySeries(
      await this.countDialogsByDay(input.tenantId, range),
      range,
    );
  }

  private async queryLeads(
    input: AnalyticsQueryRequest,
    range: DateRange,
  ): Promise<AnalyticsSeriesPoint[]> {
    if (input.dimension === 'source') {
      const rows = await this.prisma.$queryRaw<
        Array<{ label: string; value: bigint }>
      >`
        SELECT COALESCE(s.name, 'Без источника') as label, COUNT(*)::bigint as value
        FROM leads l
        LEFT JOIN sources s ON s.id = l.source_id
        WHERE l.archived = false
          AND l.created_at >= ${range.from}
          AND l.created_at <= ${range.to}
          ${input.tenantId ? Prisma.sql`AND l.tenant_id = ${input.tenantId}::uuid` : Prisma.empty}
        GROUP BY s.name
        ORDER BY value DESC
      `;
      return rows.map((row) => ({
        label: row.label,
        value: Number(row.value),
      }));
    }

    return this.fillDaySeries(
      await this.countLeadsByDay(input.tenantId, range),
      range,
    );
  }

  private async queryConversion(
    input: AnalyticsQueryRequest,
    range: DateRange,
  ): Promise<AnalyticsSeriesPoint[]> {
    const tenantFilter = input.tenantId
      ? Prisma.sql`AND d.tenant_id = ${input.tenantId}::uuid`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{ label: string; dialogs: bigint; leads: bigint }>
    >`
      SELECT to_char(date_trunc('day', d.created_at), 'YYYY-MM-DD') as label,
             COUNT(DISTINCT d.id)::bigint as dialogs,
             COUNT(DISTINCT l.id)::bigint as leads
      FROM dialogs d
      LEFT JOIN leads l ON l.dialog_id = d.id AND l.archived = false
      WHERE d.created_at >= ${range.from}
        AND d.created_at <= ${range.to}
        ${tenantFilter}
      GROUP BY 1
      ORDER BY 1
    `;

    return rows.map((row) => ({
      label: row.label,
      value:
        Number(row.dialogs) > 0
          ? Math.round((Number(row.leads) / Number(row.dialogs)) * 1000) / 10
          : 0,
      meta: { dialogs: Number(row.dialogs), leads: Number(row.leads) },
    }));
  }

  private async countDialogsByDay(
    tenantId: string | undefined,
    range: DateRange,
  ) {
    const rows = await this.prisma.$queryRaw<
      Array<{ label: string; value: bigint }>
    >`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as label,
             COUNT(*)::bigint as value
      FROM dialogs
      WHERE created_at >= ${range.from}
        AND created_at <= ${range.to}
        ${tenantId ? Prisma.sql`AND tenant_id = ${tenantId}::uuid` : Prisma.empty}
      GROUP BY 1
      ORDER BY 1
    `;
    return rows.map((row) => ({
      label: row.label,
      value: Number(row.value),
    }));
  }

  private async countLeadsByDay(tenantId: string | undefined, range: DateRange) {
    const rows = await this.prisma.$queryRaw<
      Array<{ label: string; value: bigint }>
    >`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as label,
             COUNT(*)::bigint as value
      FROM leads
      WHERE archived = false
        AND created_at >= ${range.from}
        AND created_at <= ${range.to}
        ${tenantId ? Prisma.sql`AND tenant_id = ${tenantId}::uuid` : Prisma.empty}
      GROUP BY 1
      ORDER BY 1
    `;
    return rows.map((row) => ({
      label: row.label,
      value: Number(row.value),
    }));
  }

  private async countWonLeads(tenantId: string, range: DateRange) {
    return this.prisma.lead.count({
      where: {
        tenantId,
        archived: false,
        createdAt: { gte: range.from, lte: range.to },
        status: {
          name: { in: DEAL_WON_STATUS_NAMES },
        },
      },
    });
  }

  private fillDaySeries(
    series: AnalyticsSeriesPoint[],
    range: DateRange,
  ): AnalyticsSeriesPoint[] {
    const map = new Map(series.map((row) => [row.label, row.value]));
    const result: AnalyticsSeriesPoint[] = [];
    const cursor = new Date(range.from);
    cursor.setUTCHours(0, 0, 0, 0);
    const end = new Date(range.to);
    end.setUTCHours(0, 0, 0, 0);

    while (cursor <= end) {
      const label = cursor.toISOString().slice(0, 10);
      result.push({ label, value: map.get(label) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return result;
  }

  private parseRange(from: string, to: string): DateRange {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (/^\d{4}-\d{2}-\d{2}$/.test(from.trim())) {
      fromDate.setUTCHours(0, 0, 0, 0);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(to.trim())) {
      toDate.setUTCHours(23, 59, 59, 999);
    }

    return { from: fromDate, to: toDate };
  }
}
