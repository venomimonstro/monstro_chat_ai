export type OutgoingWebhookEvent = 'lead.created' | 'dialog.closed';

export interface OutgoingWebhookDto {
  url: string;
  enabled: boolean;
  events: OutgoingWebhookEvent[];
  hasSecret: boolean;
}

export interface SaveOutgoingWebhookDto {
  url: string;
  secret?: string;
  enabled?: boolean;
  events?: OutgoingWebhookEvent[];
}
