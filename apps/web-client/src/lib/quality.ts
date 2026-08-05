import { api } from './api';
import { withRetry } from './retry';
import type {
  BadAnswersListResponse,
  QualityStatsDto,
} from '@ai-consultant/shared-types';

export async function fetchQualityStats(sourceId?: string) {
  return withRetry(() =>
    api
      .get<QualityStatsDto>('/quality/stats', {
        params: sourceId ? { sourceId } : undefined,
      })
      .then((r) => r.data),
  );
}

export async function fetchBadAnswers(params?: {
  sourceId?: string;
  cursor?: string;
  limit?: number;
}) {
  return withRetry(() =>
    api
      .get<BadAnswersListResponse>('/quality/bad-answers', {
        params: {
          ...(params?.sourceId ? { sourceId: params.sourceId } : {}),
          ...(params?.cursor ? { cursor: params.cursor } : {}),
          ...(params?.limit ? { limit: String(params.limit) } : {}),
        },
      })
      .then((r) => r.data),
  );
}
