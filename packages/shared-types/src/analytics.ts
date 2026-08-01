export type ModelTier = 'cheap' | 'premium';

export interface TenantMarginDto {
  tenantId: string;
  tenantName: string;
  periodFrom: string;
  periodTo: string;
  revenueRub: number;
  llmCostUsd: number;
  llmCostRub: number;
  marginRub: number;
  marginPercent: number;
  transactionCount: number;
  llmCallCount: number;
  cacheHitCount: number;
}
