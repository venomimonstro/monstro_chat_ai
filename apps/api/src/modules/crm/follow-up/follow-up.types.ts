export interface FollowUpJobPayload {
  dialogId: string;
  tenantId: string;
  sourceId: string;
  visitorId: string;
  attemptIndex: number;
}

export interface FollowUpPushPayload {
  dialogId: string;
  messageId: string;
  content: string;
  createdAt: string;
  visitorId: string;
}
