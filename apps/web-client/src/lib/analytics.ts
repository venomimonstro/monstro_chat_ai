import { api } from './api';
import { withRetry } from './retry';
import type { TenantStatisticsDto } from '@ai-consultant/shared-types';

export async function fetchTenantStatistics(
  from: string,
  to: string,
  sourceId?: string,
) {
  return withRetry(() =>
    api
      .get<TenantStatisticsDto>('/analytics/statistics', {
        params: {
          from,
          to,
          ...(sourceId ? { sourceId } : {}),
        },
      })
      .then((r) => r.data),
  );
}

export async function downloadTenantStatisticsCsv(
  from: string,
  to: string,
  sourceId?: string,
) {
  const res = await api.get('/analytics/export.csv', {
    params: {
      from,
      to,
      ...(sourceId ? { sourceId } : {}),
    },
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'statistics.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
