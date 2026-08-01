import { Injectable } from '@nestjs/common';
import type {
  AnalyticsQueryResponse,
  TenantStatisticsDto,
} from '@ai-consultant/shared-types';

@Injectable()
export class AnalyticsExportService {
  toCsv(
    data: AnalyticsQueryResponse | TenantStatisticsDto,
    kind: 'query' | 'tenant',
  ): string {
    if (kind === 'tenant') {
      const stats = data as TenantStatisticsDto;
      const lines = [
        'section,label,value',
        `summary,dialogs,${stats.dialogs}`,
        `summary,leads,${stats.leads}`,
        `summary,messages,${stats.messages}`,
        `summary,conversionRate,${stats.conversionRate}`,
      ];
      for (const row of stats.dialogsByDay) {
        lines.push(`dialogsByDay,${row.label},${row.value}`);
      }
      for (const row of stats.leadsByDay) {
        lines.push(`leadsByDay,${row.label},${row.value}`);
      }
      for (const row of stats.funnel) {
        lines.push(`funnel,${row.stage},${row.count}`);
      }
      return lines.join('\n');
    }

    const query = data as AnalyticsQueryResponse;
    const lines = [
      'label,value',
      ...query.series.map((row) => `${this.escape(row.label)},${row.value}`),
      `total,${query.total}`,
    ];
    return lines.join('\n');
  }

  toHtmlReport(
    data: AnalyticsQueryResponse | TenantStatisticsDto,
    title: string,
  ): string {
    const body =
      'series' in data
        ? `<table><tr><th>Label</th><th>Value</th></tr>${data.series
            .map(
              (row) =>
                `<tr><td>${this.escape(row.label)}</td><td>${row.value}</td></tr>`,
            )
            .join('')}</table><p>Total: ${data.total}</p>`
        : `<p>Диалоги: ${data.dialogs}, Лиды: ${data.leads}, Конверсия: ${data.conversionRate}%</p>`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${this.escape(title)}</title></head><body><h1>${this.escape(title)}</h1>${body}</body></html>`;
  }

  private escape(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
