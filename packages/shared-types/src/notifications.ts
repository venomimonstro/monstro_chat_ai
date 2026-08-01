export type NotificationType =
  | 'lead.created'
  | 'usage.threshold'
  | 'trial.expiring';

export interface NotificationDto {
  id: string;
  tenantId: string;
  userId: string | null;
  type: NotificationType | string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsListDto {
  items: NotificationDto[];
  unreadCount: number;
}
