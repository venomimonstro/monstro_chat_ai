import type { SourceType } from '@prisma/client';

export interface UnifiedInboundMessage {
  tenantId: string;
  sourceId: string;
  sourceType: SourceType;
  visitorId: string;
  dialogId?: string;
  content: string;
  replyMeta?: Record<string, unknown>;
}

export interface UnifiedOutboundMessage {
  content: string;
  replyMeta?: Record<string, unknown>;
}

export interface IChannelAdapter {
  readonly type: SourceType;
  parseInbound(
    payload: unknown,
    source: { id: string; tenantId: string; configJson: unknown },
  ): UnifiedInboundMessage | null;
  sendReply(
    outbound: UnifiedOutboundMessage,
    inbound: UnifiedInboundMessage,
    source: { id: string; tenantId: string; configJson: unknown },
  ): Promise<void>;
}
