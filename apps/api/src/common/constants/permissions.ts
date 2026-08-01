export const PERMISSIONS = {
  CRM_LEADS_VIEW: 'crm.leads.view',
  CRM_LEADS_EDIT: 'crm.leads.edit',
  SOURCES_MANAGE: 'sources.manage',
  CHATS_VIEW: 'chats.view',
  SETTINGS_MANAGE: 'settings.manage',
  ADMIN_TENANTS_VIEW: 'admin.tenants.view',
  ADMIN_TENANTS_MANAGE: 'admin.tenants.manage',
  ADMIN_UPDATES_VIEW: 'admin.updates.view',
  ADMIN_UPDATES_MANAGE: 'admin.updates.manage',
  ADMIN_ANALYTICS_VIEW: 'admin.analytics.view',
  ADMIN_ANALYTICS_MANAGE: 'admin.analytics.manage',
  ANALYTICS_VIEW: 'analytics.view',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLES_REQUIRING_2FA = ['owner', 'admin'] as const;
