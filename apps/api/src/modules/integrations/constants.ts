export const QUEUE_CRM_EXPORT = 'crm-export';
export const QUEUE_CRM_STATUS_SYNC = 'crm-status-sync';
export const QUEUE_LEAD_DELIVERY = 'lead-delivery';

export const CRM_EXPORT_MAX_ATTEMPTS = 5;
export const LEAD_DELIVERY_MAX_ATTEMPTS = 5;
export const CRM_SYNC_LOCK_TTL_SEC = 5;

export const INTERNAL_CRM_FIELDS = [
  'name',
  'phone',
  'email',
  'notes',
  'utm_source',
  'utm_campaign',
  'referrer',
  'landing_page',
] as const;

export type InternalCrmField = (typeof INTERNAL_CRM_FIELDS)[number];

export const DEFAULT_AMOCRM_FIELD_MAPPING: Record<InternalCrmField, string> = {
  name: 'name',
  phone: 'PHONE',
  email: 'EMAIL',
  notes: 'notes',
  utm_source: 'UTM_SOURCE',
  utm_campaign: 'UTM_CAMPAIGN',
  referrer: 'REFERRER',
  landing_page: 'LANDING_PAGE',
};

export const DEFAULT_BITRIX24_FIELD_MAPPING: Record<InternalCrmField, string> = {
  name: 'TITLE',
  phone: 'PHONE',
  email: 'EMAIL',
  notes: 'COMMENTS',
  utm_source: 'UTM_SOURCE',
  utm_campaign: 'UTM_CAMPAIGN',
  referrer: 'REFERRER',
  landing_page: 'LANDING_PAGE',
};
