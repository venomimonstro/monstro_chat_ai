import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AnalyticsDimension,
  AnalyticsMetric,
  AnalyticsQueryRequest,
  AnalyticsQueryResponse,
  AnalyticsSeriesPoint,
  TenantStatisticsDto,
} from '@ai-consultant/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnalyticsCacheService } from './analytics-cache.service';

interface DateRange {
  from: Date;
  to: Date;
}

@Injectable()
export class ReportBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AnalyticsCacheService,
  ) {}

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
    const cacheKey = { type: 'tenant-stats', tenantId, from, to };
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
      dialogsByDay,
      leadsByDay,
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
      default:
        return [];
    }
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

    return this.countDialogsByDay(input.tenantId, range);
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

    return this.countLeadsByDay(input.tenantId, range);
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
          name: { in: ['Продажа', 'Успешно', 'Won', 'Closed Won'] },
        },
      },
    });
  }

  private parseRange(from: string, to: string): DateRange {
    return { from: new Date(from), to: new Date(to) };
  }
}
