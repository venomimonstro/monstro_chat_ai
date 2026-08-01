import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Source } from '@prisma/client';
import type {
  UnifiedInboundMessage,
  UnifiedOutboundMessage,
  IChannelAdapter,
} from './channel.types';
import { ChannelsSetupService } from './channels-setup.service';

@Injectable()
export class TelegramChannelAdapter implements IChannelAdapter {
  readonly type = 'telegram' as const;
  private readonly logger = new Logger(TelegramChannelAdapter.name);

  constructor(
    private readonly setup: ChannelsSetupService,
    private readonly config: ConfigService,
  ) {}

  parseInbound(
    payload: unknown,
    source: { id: string; tenantId: string },
  ): UnifiedInboundMessage | null {
    const update = payload as {
      message?: {
        text?: string;
        chat?: { id: number };
        from?: { id: number };
      };
    };
    const message = update.message;
    if (!message?.text?.trim() || !message.from) return null;

    return {
      tenantId: source.tenantId,
      sourceId: source.id,
      sourceType: 'telegram',
      visitorId: `tg:${message.from.id}`,
      content: message.text.trim(),
      replyMeta: { chatId: message.chat?.id },
    };
  }

  async sendReply(
    outbound: UnifiedOutboundMessage,
    inbound: UnifiedInboundMessage,
    source: { configJson: unknown },
  ) {
    const token = this.setup.decryptTelegramToken(source.configJson);
    const chatId = inbound.replyMeta?.chatId;
    if (!token || chatId === undefined) {
      this.logger.warn('Telegram reply skipped: missing token or chatId');
      return;
    }

    const fetchFn = this.config.get<typeof fetch>('CRM_HTTP_FETCH') ?? fetch;
    await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: outbound.content }),
    });
  }
}

@Injectable()
export class VkChannelAdapter implements IChannelAdapter {
  readonly type = 'vk' as const;
  private readonly logger = new Logger(VkChannelAdapter.name);

  constructor(
    private readonly setup: ChannelsSetupService,
    private readonly config: ConfigService,
  ) {}

  parseInbound(
    payload: unknown,
    source: { id: string; tenantId: string; configJson: unknown },
  ): UnifiedInboundMessage | null {
    const body = payload as {
      type?: string;
      object?: {
        message?: { id?: number; from_id?: number; text?: string; peer_id?: number };
      };
    };

    if (body.type === 'confirmation') return null;

    const message = body.object?.message;
    if (!message?.text?.trim() || !message.from_id) return null;

    return {
      tenantId: source.tenantId,
      sourceId: source.id,
      sourceType: 'vk',
      visitorId: `vk:${message.from_id}`,
      content: message.text.trim(),
      replyMeta: {
        peerId: message.peer_id ?? message.from_id,
        messageId: message.id,
      },
    };
  }

  async sendReply(
    outbound: UnifiedOutboundMessage,
    inbound: UnifiedInboundMessage,
    source: { configJson: unknown },
  ) {
    const token = this.setup.decryptVkToken(source.configJson);
    const peerId = inbound.replyMeta?.peerId;
    if (!token || peerId === undefined) {
      this.logger.warn('VK reply skipped: missing token or peerId');
      return;
    }

    const fetchFn = this.config.get<typeof fetch>('CRM_HTTP_FETCH') ?? fetch;
    const params = new URLSearchParams({
      access_token: token,
      v: '5.199',
      peer_id: String(peerId),
      message: outbound.content,
      random_id: String(Date.now()),
    });

    await fetchFn('https://api.vk.com/method/messages.send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
  }

  getConfirmationResponse(configJson: unknown): string | null {
    const channel = (configJson as { channel?: { vk?: { confirmationCode?: string } } })
      ?.channel?.vk;
    return channel?.confirmationCode ?? null;
  }
}

@Injectable()
export class ChannelRegistryService {
  constructor(
    private readonly telegram: TelegramChannelAdapter,
    private readonly vk: VkChannelAdapter,
  ) {}

  getAdapter(type: Source['type']): IChannelAdapter | null {
    if (type === 'telegram') return this.telegram;
    if (type === 'vk') return this.vk;
    return null;
  }
}
