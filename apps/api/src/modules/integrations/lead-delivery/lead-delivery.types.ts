import type { LeadDeliveryChannelType } from '@prisma/client';
import type { LeadDeliveryChannel } from '@prisma/client';

export interface LeadDeliveryLeadData {
  id: string;
  tenantId: string;
  dialogId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  utmJson: unknown;
  referrer: string | null;
  landingPage: string | null;
  externalId: string | null;
  externalCrmType: string | null;
  sourceName: string | null;
  createdAt: Date;
}

export interface LeadDeliveryContext {
  channel: LeadDeliveryChannel;
  lead: LeadDeliveryLeadData;
  credentials: Record<string, unknown>;
  config: Record<string, unknown>;
  webClientUrl: string;
  test: boolean;
}

export interface LeadDeliveryValidationResult {
  ok: boolean;
  details?: Record<string, string>;
  error?: string;
}

export interface ILeadDeliveryAdapter {
  readonly type: LeadDeliveryChannelType;
  validate?(
    credentials: Record<string, unknown>,
    config: Record<string, unknown>,
  ): Promise<LeadDeliveryValidationResult>;
  deliver(ctx: LeadDeliveryContext): Promise<void>;
}

export interface LeadDeliveryJobPayload {
  tenantId: string;
  leadId: string;
  channelId: string;
  test?: boolean;
}

export function splitLeadName(name: string | null): {
  firstName: string;
  lastName: string;
} {
  if (!name?.trim()) return { firstName: '', lastName: '' };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function formatLeadFields(lead: LeadDeliveryLeadData) {
  const { firstName, lastName } = splitLeadName(lead.name);
  const utm = (lead.utmJson ?? {}) as Record<string, string>;
  const utmParts = [
    utm.utm_source,
    utm.utm_medium,
    utm.utm_campaign,
  ].filter(Boolean);

  return {
    firstName,
    lastName,
    phone: lead.phone ?? '',
    email: lead.email ?? '',
    source: lead.sourceName ?? '—',
    utm: utmParts.length ? utmParts.join(' / ') : '—',
    referrer: lead.referrer ?? '—',
    landingPage: lead.landingPage ?? '—',
    createdAt: lead.createdAt.toISOString(),
  };
}

export function buildCrmLeadUrl(webClientUrl: string, leadId: string) {
  return `${webClientUrl.replace(/\/$/, '')}/crm?lead=${leadId}`;
}
