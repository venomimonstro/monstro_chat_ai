import axios from 'axios';
import type {
  AuthResponse,
  AuditLogDto,
  AuditLogListQuery,
  BackupSnapshotDto,
  CreateSystemUpdateDto,
  ImpersonateResponseDto,
  PaginatedResponse,
  ResetPasswordResponseDto,
  SystemUpdateDto,
  TariffDto,
  TenantDetailDto,
  TenantListItemDto,
  TenantListQuery,
  TenantMarginDto,
  Verify2faRequest,
} from '@ai-consultant/shared-types';

function getCsrfTokenFromCookie(): string | null {
  const match = document.cookie.match(/(?:^|; )aicw_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

let csrfTokenMemory: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfTokenMemory = token;
}

function getCsrfToken(): string | null {
  const fromCookie = getCsrfTokenFromCookie();
  if (fromCookie) {
    csrfTokenMemory = fromCookie;
    return fromCookie;
  }
  return csrfTokenMemory;
}

export async function ensureCsrfToken(): Promise<string | null> {
  try {
    const res = await api.get<{ token: string | null }>('/auth/csrf');
    if (res.data.token) {
      setCsrfToken(res.data.token);
      return res.data.token;
    }
  } catch {
    /* ignore */
  }
  try {
    const res = await api.post<{ success: boolean; csrfToken?: string }>(
      '/auth/refresh',
    );
    if (res.data.csrfToken) {
      setCsrfToken(res.data.csrfToken);
      return res.data.csrfToken;
    }
  } catch {
    /* ignore */
  }
  const fromCookie = getCsrfTokenFromCookie();
  if (fromCookie) {
    setCsrfToken(fromCookie);
    return fromCookie;
  }
  return null;
}

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const method = config.method?.toUpperCase();
  if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getCsrfToken() ?? (await ensureCsrfToken());
    if (csrf) {
      config.headers['X-CSRF-Token'] = csrf;
    }
  }
  return config;
});

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = api
      .post<{ success: boolean; csrfToken?: string }>('/auth/refresh')
      .then(async (res) => {
        if (res.data.csrfToken) {
          setCsrfToken(res.data.csrfToken);
        } else {
          await ensureCsrfToken();
        }
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 403 &&
      original &&
      !original._csrfRetry &&
      typeof error.response?.data?.message === 'string' &&
      error.response.data.message.includes('CSRF')
    ) {
      original._csrfRetry = true;
      setCsrfToken(null);
      await refreshSession();
      await ensureCsrfToken();
      return api(original);
    }
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/login') &&
      !original.url?.includes('/auth/2fa/verify') &&
      !original.url?.includes('/auth/register') &&
      !original.url?.includes('/auth/refresh')
    ) {
      original._retry = true;
      const ok = await refreshSession();
      if (ok) {
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export async function loginAdmin(email: string, password: string) {
  const res = await api.post<AuthResponse>('/auth/login', {
    email,
    password,
  });
  if (res.data.csrfToken) {
    setCsrfToken(res.data.csrfToken);
  }
  return res.data;
}

export async function verifyAdmin2fa(data: Verify2faRequest) {
  const res = await api.post<AuthResponse>('/auth/2fa/verify', data);
  if (res.data.csrfToken) {
    setCsrfToken(res.data.csrfToken);
  }
  return res.data;
}

export async function logoutUser() {
  await api.post('/auth/logout');
}

export async function fetchCurrentUser() {
  const res = await api.post<{ user: AuthResponse['user'] }>('/auth/me');
  return res.data.user;
}

export interface LlmProviderInfo {
  name: string;
  defaultModel: string;
  available: boolean;
  inChain: boolean;
  enabled: boolean;
  priority: number;
  apiKeyMasked: string | null;
  keySource: 'redis' | 'env' | 'none';
}

export interface ProviderTestResult {
  ok: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  error?: string;
  errorCode?: string;
  hint?: string;
}

export interface AdminSystemHealth {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  postgres: 'connected' | 'disconnected';
  redis: 'connected' | 'disconnected';
  queues: Array<{
    name: string;
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
  }>;
}

export interface CreateTariffPayload {
  name: string;
  price: number;
  period: 'month' | 'year';
  currency?: string;
  messageLimit: number;
  sourceLimit: number;
  kbLimitMb?: number;
  overagePolicy?: 'block' | 'charge' | 'allow';
  isActive?: boolean;
}

export type UpdateTariffPayload = Partial<CreateTariffPayload>;

export async function fetchAdminProviders() {
  const res = await api.get<LlmProviderInfo[]>('/admin/providers');
  return res.data;
}

export async function updateAdminProviders(data: {
  chain: string[];
  disabled: string[];
}) {
  const res = await api.patch<LlmProviderInfo[]>('/admin/providers', data);
  return res.data;
}

export async function setProviderCredentials(name: string, apiKey: string) {
  const res = await api.put<LlmProviderInfo[]>(
    `/admin/providers/${name}/credentials`,
    { apiKey },
  );
  return res.data;
}

export async function clearProviderCredentials(name: string) {
  const res = await api.delete<LlmProviderInfo[]>(
    `/admin/providers/${name}/credentials`,
  );
  return res.data;
}

export async function testProviderCredentials(name: string, apiKey?: string) {
  const res = await api.post<ProviderTestResult>(
    `/admin/providers/${name}/test`,
    apiKey ? { apiKey } : {},
  );
  return res.data;
}

export async function fetchPlatformWorkspace() {
  const res = await api.get<import('@ai-consultant/shared-types').PlatformWorkspaceDto>(
    '/admin/platform-workspace',
  );
  return res.data;
}

export async function openPlatformWorkspace() {
  await ensureCsrfToken();
  const res = await api.post<import('@ai-consultant/shared-types').ImpersonateResponseDto>(
    '/admin/platform-workspace/open',
  );
  return res.data;
}

function extractApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string | string[] } } }).response?.data;
    if (Array.isArray(data?.message)) return data.message.join(', ');
    if (typeof data?.message === 'string') return data.message;
  }
  return fallback;
}

export { extractApiError };

export async function fetchSiteSettings() {
  const res = await api.get<import('@ai-consultant/shared-types').PublicSiteSettingsDto>(
    '/admin/site-settings',
  );
  return res.data;
}

export async function fetchDiagnosticsLink() {
  const res = await api.get<import('@ai-consultant/shared-types').DiagnosticsLinkDto>(
    '/admin/site-settings/diagnostics-link',
  );
  return res.data;
}

export async function regenerateDiagnosticsLink() {
  const res = await api.post<import('@ai-consultant/shared-types').DiagnosticsLinkDto>(
    '/admin/site-settings/diagnostics-link/regenerate',
  );
  return res.data;
}

export async function updateSiteSettings(
  data: import('@ai-consultant/shared-types').UpdatePublicSiteSettingsDto,
) {
  await ensureCsrfToken();
  const res = await api.patch<import('@ai-consultant/shared-types').PublicSiteSettingsDto>(
    '/admin/site-settings',
    data,
  );
  return res.data;
}

export async function fetchSystemHealth() {
  const res = await api.get<AdminSystemHealth>('/admin/system/health');
  return res.data;
}

export async function fetchAdminTenants(query: TenantListQuery = {}) {
  const res = await api.get<PaginatedResponse<TenantListItemDto>>(
    '/admin/tenants',
    { params: query },
  );
  return res.data;
}

export async function fetchTenantDetail(tenantId: string) {
  const res = await api.get<TenantDetailDto>(`/admin/tenants/${tenantId}`);
  return res.data;
}

export async function fetchTenantMargin(
  tenantId: string,
  from?: string,
  to?: string,
) {
  const res = await api.get<TenantMarginDto>(`/admin/tenants/${tenantId}/margin`, {
    params: { from, to },
  });
  return res.data;
}

export async function blockTenant(tenantId: string, reason: string) {
  const res = await api.patch<TenantDetailDto>(
    `/admin/tenants/${tenantId}/block`,
    { reason },
  );
  return res.data;
}

export async function unblockTenant(tenantId: string, reason: string) {
  const res = await api.patch<TenantDetailDto>(
    `/admin/tenants/${tenantId}/unblock`,
    { reason },
  );
  return res.data;
}

export async function changeTenantTariff(
  tenantId: string,
  tariffId: string,
  reason: string,
) {
  const res = await api.patch<TenantDetailDto>(
    `/admin/tenants/${tenantId}/tariff`,
    { tariffId, reason },
  );
  return res.data;
}

export async function adjustTenantBalance(
  tenantId: string,
  amount: number,
  reason: string,
) {
  const res = await api.post<TenantDetailDto>(
    `/admin/tenants/${tenantId}/balance-adjustment`,
    { amount, reason },
  );
  return res.data;
}

export async function resetTenantPassword(tenantId: string, reason: string) {
  const res = await api.post<ResetPasswordResponseDto>(
    `/admin/tenants/${tenantId}/reset-password`,
    { reason },
  );
  return res.data;
}

export async function impersonateTenant(tenantId: string, reason: string) {
  const res = await api.post<ImpersonateResponseDto>(
    `/admin/tenants/${tenantId}/impersonate`,
    { reason },
  );
  return res.data;
}

export async function fetchAuditLogs(query: AuditLogListQuery = {}) {
  const res = await api.get<PaginatedResponse<AuditLogDto>>(
    '/admin/audit-logs',
    { params: query },
  );
  return res.data;
}

export async function fetchAdminTariffs() {
  const res = await api.get<TariffDto[]>('/billing/admin/tariffs');
  return res.data;
}

export async function createAdminTariff(data: CreateTariffPayload) {
  const res = await api.post<TariffDto>('/billing/admin/tariffs', data);
  return res.data;
}

export async function updateAdminTariff(id: string, data: UpdateTariffPayload) {
  const res = await api.patch<TariffDto>(`/billing/admin/tariffs/${id}`, data);
  return res.data;
}

export async function deactivateAdminTariff(id: string) {
  const res = await api.delete<TariffDto>(`/billing/admin/tariffs/${id}`);
  return res.data;
}

export async function bulkBlockTenants(tenantIds: string[], reason: string) {
  const res = await api.post<{ blocked: number; tenantIds: string[] }>(
    '/admin/tenants/bulk-block',
    { tenantIds, reason },
  );
  return res.data;
}

export async function downloadTenantsCsv(query: TenantListQuery = {}) {
  const res = await api.get('/admin/tenants/export.csv', {
    params: query,
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'tenants.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function fetchSystemUpdates() {
  const res = await api.get<SystemUpdateDto[]>('/admin/updates');
  return res.data;
}

export async function fetchSystemUpdate(id: string) {
  const res = await api.get<SystemUpdateDto>(`/admin/updates/${id}`);
  return res.data;
}

export async function createSystemUpdate(data: CreateSystemUpdateDto) {
  const res = await api.post<SystemUpdateDto>('/admin/updates', data);
  return res.data;
}

export async function startUpdateTest(id: string) {
  const res = await api.post<SystemUpdateDto>(`/admin/updates/${id}/test`);
  return res.data;
}

export async function approveUpdate(id: string) {
  const res = await api.post<SystemUpdateDto>(`/admin/updates/${id}/approve`);
  return res.data;
}

export async function rollbackUpdate(id: string, rollbackVersion?: string) {
  const res = await api.post<SystemUpdateDto>(`/admin/updates/${id}/rollback`, {
    rollbackVersion: rollbackVersion ?? 'previous',
  });
  return res.data;
}

export async function fetchCurrentRelease() {
  const res = await api.get<import('@ai-consultant/shared-types').ReleaseManifestDto>(
    '/admin/release/current',
  );
  return res.data;
}

export async function fetchSprints() {
  const res = await api.get<import('@ai-consultant/shared-types').SprintInfoDto[]>(
    '/admin/release/sprints',
  );
  return res.data;
}

export async function fetchDeploymentRecords() {
  const res = await api.get<import('@ai-consultant/shared-types').DeploymentRecordDto[]>(
    '/admin/release/deployments',
  );
  return res.data;
}

export async function requestRollbackToVersion(version: string) {
  const res = await api.post<{
    ok: boolean;
    version?: string;
    sprint?: number;
    command: string;
    message: string;
  }>(`/admin/release/rollback/${encodeURIComponent(version)}`);
  return res.data;
}

export async function fetchStabilityStatus() {
  const res = await api.get<import('@ai-consultant/shared-types').StabilityStatusDto>(
    '/admin/stability/status',
  );
  return res.data;
}

export async function fetchStabilityIncidents() {
  const res = await api.get<import('@ai-consultant/shared-types').StabilityIncidentDto[]>(
    '/admin/stability/incidents',
  );
  return res.data;
}

export async function runStabilityCheck() {
  const res = await api.post<import('@ai-consultant/shared-types').StabilityStatusDto>(
    '/admin/stability/check',
  );
  return res.data;
}

export async function fetchDeployInstructions(id: string) {
  const res = await api.get<
    import('@ai-consultant/shared-types').ReleaseDeployInstructionsDto
  >(`/admin/release/updates/${id}/instructions`);
  return res.data;
}

export async function fetchBackups() {
  const res = await api.get<BackupSnapshotDto[]>('/admin/backups');
  return res.data;
}

export async function createBackup(label?: string) {
  const res = await api.post<BackupSnapshotDto>('/admin/backups', { label });
  return res.data;
}

export async function restoreBackup(id: string) {
  const res = await api.post(`/admin/backups/${id}/restore`);
  return res.data;
}

export async function fetchAnalyticsQuery(params: {
  metric: string;
  dimension?: string;
  from: string;
  to: string;
  tenantId?: string;
}) {
  const res = await api.get<import('@ai-consultant/shared-types').AnalyticsQueryResponse>(
    '/admin/analytics/query',
    { params },
  );
  return res.data;
}

export async function fetchAnalyticsDashboards() {
  const res = await api.get<
    import('@ai-consultant/shared-types').AnalyticsDashboardDto[]
  >('/admin/analytics/dashboards');
  return res.data;
}

export async function createAnalyticsDashboard(
  data: import('@ai-consultant/shared-types').SaveAnalyticsDashboardDto,
) {
  const res = await api.post<
    import('@ai-consultant/shared-types').AnalyticsDashboardDto
  >('/admin/analytics/dashboards', data);
  return res.data;
}

export async function updateAnalyticsDashboard(
  id: string,
  data: import('@ai-consultant/shared-types').SaveAnalyticsDashboardDto,
) {
  const res = await api.patch<
    import('@ai-consultant/shared-types').AnalyticsDashboardDto
  >(`/admin/analytics/dashboards/${id}`, data);
  return res.data;
}
