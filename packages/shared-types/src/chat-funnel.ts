export type ChatFunnelEventType =
  | 'widget_open'
  | 'first_message'
  | 'contact_shared'
  | 'lead_created';

export interface WidgetFunnelEventRequest {
  widgetKey: string;
  visitorId: string;
  eventType: 'widget_open';
  attribution?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    referrer?: string;
    landingPage?: string;
  };
}

export interface ChatFunnelStageDto {
  key: ChatFunnelEventType;
  label: string;
  count: number;
  rateFromTop: number;
  dropOffFromPrevious: number | null;
}

export interface ChatFunnelBreakdownRowDto {
  label: string;
  widgetOpen: number;
  firstMessage: number;
  contactShared: number;
  leadCreated: number;
}

export interface ChatFunnelDto {
  stages: ChatFunnelStageDto[];
  byUtmSource: ChatFunnelBreakdownRowDto[];
  byLandingPage: ChatFunnelBreakdownRowDto[];
}
