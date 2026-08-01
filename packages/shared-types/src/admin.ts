import type { TenantStatus } from './index';

export type AuditAction =
  | 'tenant.block'
  | 'tenant.unblock'
  | 'tenant.tariff_change'
  | 'tenant.balance_adjustment'
  | 'tenant.password_reset'
  | 'tenant.impersonate';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface TenantListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: TenantStatus;
}

export interface TenantListItemDto {
  id: string;
  name: string;
  status: TenantStatus;
  balance: number;
  tariffName: string | null;
  ownerEmail: string | null;
  createdAt: string;
  revenueRub?: number;
  llmCostRub?: number;
  marginRub?: number;
}

export interface TenantDetailDto {
  id: string;
  name: string;
  status: TenantStatus;
  balance: number;
  trialEndsAt: string | null;
  createdAt: string;
  tariff: { id: string; name: string; price: number } | null;
  owner: { id: string; email: string } | null;
  stats: {
    users: number;
    dialogs: number;
    leads: number;
    sources: number;
  };
}

export interface TenantActionReasonDto {
  reason: string;
}

export interface TenantTariffChangeDto {
  tariffId: string;
  reason: string;
}

export interface TenantBalanceAdjustmentDto {
  amount: number;
  reason: string;
}

export interface ImpersonateTenantDto {
  reason: string;
}

export interface ImpersonateResponseDto {
  exchangeCode: string;
  expiresIn: number;
  webClientUrl: string;
  tenantId: string;
  tenantName: string;
}

export interface ResetPasswordResponseDto {
  userEmail: string;
  temporaryPassword?: string;
}

export interface AuditLogDto {
  id: string;
  actorUserId: string;
  actorEmail: string;
  targetTenantId: string | null;
  targetUserId: string | null;
  action: string;
  reason: string | null;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  prevHash: string | null;
  recordHash: string;
  createdAt: string;
}

export interface AuditLogListQuery {
  page?: number;
  limit?: number;
  action?: string;
  targetTenantId?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  search?: string;
}
