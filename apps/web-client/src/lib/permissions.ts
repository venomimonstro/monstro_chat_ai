import type { AuthUser } from '@ai-consultant/shared-types';

export const PERMISSIONS = {
  CRM_LEADS_VIEW: 'crm.leads.view',
  CRM_LEADS_EDIT: 'crm.leads.edit',
  SOURCES_MANAGE: 'sources.manage',
  CHATS_VIEW: 'chats.view',
  SETTINGS_MANAGE: 'settings.manage',
  ANALYTICS_VIEW: 'analytics.view',
} as const;

export function hasPermission(user: AuthUser | null, permission: string): boolean {
  if (!user) return false;
  if (user.role === 'client' || user.role === 'owner') return true;
  return user.permissions?.includes(permission) ?? false;
}

export function hasAnyPermission(
  user: AuthUser | null,
  permissions: string[],
): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

export const NAV_ITEMS = [
  { to: '/', label: 'Главная', short: '⌂', end: true as const, permissions: null as string[] | null },
  { to: '/sources', label: 'Источники', short: '◎', end: false as const, permissions: [PERMISSIONS.SOURCES_MANAGE] },
  { to: '/crm', label: 'CRM', short: '▦', end: false as const, permissions: [PERMISSIONS.CRM_LEADS_VIEW] },
  { to: '/billing', label: 'Тариф', short: '₽', end: false as const, permissions: [PERMISSIONS.SETTINGS_MANAGE] },
  { to: '/integrations', label: 'Интеграции', short: '⚡', end: false as const, permissions: [PERMISSIONS.SETTINGS_MANAGE] },
  { to: '/statistics', label: 'Статистика', short: '📊', end: false as const, permissions: [PERMISSIONS.ANALYTICS_VIEW] },
  { to: '/settings', label: 'Настройки', short: '⚙', end: false as const, permissions: [PERMISSIONS.SETTINGS_MANAGE] },
] as const;

export function getVisibleNavItems(user: AuthUser | null) {
  return NAV_ITEMS.filter(
    (item) => !item.permissions || hasAnyPermission(user, [...item.permissions]),
  );
}
