import type { AttributionDto } from '@ai-consultant/shared-types';

export interface DialogAttributionInput {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
  landingPage?: string;
  yandexClientId?: string;
  gaClientId?: string;
}

export function attributionToUtmJson(
  attribution?: DialogAttributionInput | null,
): Record<string, string> {
  if (!attribution) return {};
  const utm: Record<string, string> = {};
  if (attribution.utmSource) utm.utm_source = attribution.utmSource;
  if (attribution.utmMedium) utm.utm_medium = attribution.utmMedium;
  if (attribution.utmCampaign) utm.utm_campaign = attribution.utmCampaign;
  if (attribution.utmContent) utm.utm_content = attribution.utmContent;
  if (attribution.utmTerm) utm.utm_term = attribution.utmTerm;
  return utm;
}

export function leadAttributionFromDialog(dialog: {
  utmJson: unknown;
  referrer: string | null;
  landingPage: string | null;
  yandexClientId: string | null;
  gaClientId: string | null;
}) {
  const utm = (dialog.utmJson ?? {}) as Record<string, string>;
  return {
    utmJson: utm,
    referrer: dialog.referrer,
    landingPage: dialog.landingPage,
    yandexClientId: dialog.yandexClientId,
    gaClientId: dialog.gaClientId,
  };
}

export function toAttributionDto(lead: {
  utmJson: unknown;
  referrer: string | null;
  landingPage: string | null;
  yandexClientId: string | null;
  gaClientId: string | null;
}): AttributionDto {
  const utm = (lead.utmJson ?? {}) as Record<string, string>;
  return {
    utmSource: utm.utm_source ?? null,
    utmMedium: utm.utm_medium ?? null,
    utmCampaign: utm.utm_campaign ?? null,
    utmContent: utm.utm_content ?? null,
    utmTerm: utm.utm_term ?? null,
    referrer: lead.referrer,
    landingPage: lead.landingPage,
    yandexClientId: lead.yandexClientId,
    gaClientId: lead.gaClientId,
  };
}
