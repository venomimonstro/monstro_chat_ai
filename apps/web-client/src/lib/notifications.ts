import { api } from './api';
import { withRetry } from './retry';
import type { NotificationsListDto } from '@ai-consultant/shared-types';

export async function fetchNotifications(): Promise<NotificationsListDto> {
  return withRetry(() =>
    api.get<NotificationsListDto>('/notifications').then((r) => r.data),
  );
}

export async function markNotificationRead(id: string) {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  await api.post('/notifications/read-all');
}
