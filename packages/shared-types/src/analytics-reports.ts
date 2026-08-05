export type AnalyticsMetric =
  | 'mrr'
  | 'dialogs'
  | 'leads'
  | 'conversion'
  | 'llm_cost'
  | 'llm_tokens'
  | 'llm_calls';
export type AnalyticsDimension =
  | 'date'
  | 'tariff'
  | 'tenant'
  | 'source'
  | 'provider';
export type AnalyticsChartType = 'line' | 'bar' | 'table';

export interface AnalyticsQueryRequest {
  metric: AnalyticsMetric;
  dimension?: AnalyticsDimension;
  from: string;
  to: string;
  tenantId?: string;
}

export interface AnalyticsSeriesPoint {
  label: string;
  value: number;
  meta?: Record<string, string | number | null>;
}

export interface AnalyticsQueryResponse {
  metric: AnalyticsMetric;
  dimension?: AnalyticsDimension;
  from: string;
  to: string;
  series: AnalyticsSeriesPoint[];
  total: number;
  cached: boolean;
}

export interface AnalyticsWidgetConfig {
  id: string;
  metric: AnalyticsMetric;
  dimension?: AnalyticsDimension;
  chartType: AnalyticsChartType;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AnalyticsDashboardDto {
  id: string;
  scope: 'admin' | 'tenant';
  tenantId: string | null;
  name: string;
  widgets: AnalyticsWidgetConfig[];
  createdAt: string;
  updatedAt: string;
}

export interface SaveAnalyticsDashboardDto {
  name: string;
  widgets: AnalyticsWidgetConfig[];
}

export interface AnalyticsReportScheduleDto {
  id: string;
  dashboardId: string;
  recipientEmail: string;
  cronHour: number;
  cronMinute: number;
  enabled: boolean;
  lastSentAt: string | null;
}

export interface CreateReportScheduleDto {
  dashboardId: string;
  recipientEmail: string;
  cronHour: number;
  cronMinute: number;
}

export interface TenantStatisticsDto {
  from: string;
  to: string;
  dialogs: number;
  leads: number;
  messages: number;
  conversionRate: number;
  funnel: Array<{ stage: string; count: number }>;
  chatFunnel: import('./chat-funnel').ChatFunnelDto;
  dialogsByDay: AnalyticsSeriesPoint[];
  leadsByDay: AnalyticsSeriesPoint[];
}

export interface PlatformAnalyticsSummaryDto {
  from: string;
  to: string;
  revenueRub: number;
  llmCostUsd: number;
  llmCostRub: number;
  marginRub: number;
  marginPercent: number;
  llmCalls: number;
  llmTokens: number;
  dialogs: number;
  leads: number;
  activeTenants: number;
  topTenantsByCost: Array<{
    tenantId: string;
    tenantName: string;
    llmCostUsd: number;
    llmCalls: number;
  }>;
}
