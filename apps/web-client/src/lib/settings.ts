import { api } from './api';
import { withRetry } from './retry';
import type { TenantDto } from '@ai-consultant/shared-types';

export async function fetchTenant() {
  return withRetry(() => api.get<TenantDto>('/tenants/me').then((r) => r.data));
}

export async function updateTenant(id: string, name: string) {
  const res = await api.patch<TenantDto>(`/tenants/${id}`, { name });
  return res.data;
}

export async function setup2fa() {
  const res = await api.post<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup');
  return res.data;
}

export async function enable2fa(code: string) {
  await api.post('/auth/2fa/enable', { code });
}

export async function disable2fa() {
  await api.post('/auth/2fa/disable');
}
