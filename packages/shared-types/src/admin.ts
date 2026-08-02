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

export interface LlmProviderInfoDto {
  name: string;
  defaultModel: string;
  available: boolean;
  enabled: boolean;
  inChain: boolean;
  priority: number;
  apiKeyMasked: string | null;
}

export interface SetProviderCredentialsDto {
  apiKey: string;
}

export interface PublicSiteSettingsDto {
  demoWidgetKey: string;
  chatEnabled: boolean;
  welcomeTitle: string;
  welcomeText: string;
  apiUrl: string;
  widgetUrl: string;
  enabled: boolean;
  customHeadHtml: string;
  customBodyStartHtml: string;
  customBodyEndHtml: string;
}

export interface UpdatePublicSiteSettingsDto {
  demoWidgetKey?: string;
  chatEnabled?: boolean;
  welcomeTitle?: string;
  welcomeText?: string;
  customHeadHtml?: string;
  customBodyStartHtml?: string;
  customBodyEndHtml?: string;
}

export interface DiagnosticsLinkDto {
  token: string;
  pageUrl: string;
  apiUrl: string;
}

export interface PlatformWorkspaceDto {
  tenantId: string;
  tenantName: string;
  sourceId: string;
  widgetKey: string;
  webClientUrl: string;
}

export interface DeploymentRecordDto {
  id: string;
  version: string;
  sprint: number;
  gitSha: string | null;
  status: 'active' | 'superseded' | 'rolled_back';
  appliedAt: string;
  rolledBackAt: string | null;
}

export interface StabilityProbeDto {
  component: string;
  label: string;
  status: 'ok' | 'degraded' | 'down';
  message: string | null;
  latencyMs: number | null;
  checkedAt: string;
}

export interface StabilityStatusDto {
  overall: 'ok' | 'degraded' | 'down';
  timestamp: string;
  probes: StabilityProbeDto[];
  openIncidents: number;
}

export interface PublicDiagnosticsDto extends StabilityStatusDto {
  version: string;
  sprint: number;
  checkedAt: string;
  services: {
    api: string;
    webClient: string;
    webAdmin: string;
    publicSite: string;
    widget: string;
  };
}

export interface StabilityIncidentDto {
  id: string;
  component: string;
  severity: string;
  message: string;
  autoFixAttempted: boolean;
  autoFixSuccess: boolean | null;
  resolvedAt: string | null;
  createdAt: string;
}
