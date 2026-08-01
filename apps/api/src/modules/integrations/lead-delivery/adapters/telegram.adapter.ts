import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ILeadDeliveryAdapter,
  LeadDeliveryContext,
  LeadDeliveryValidationResult,
} from '../lead-delivery.types';
import {
  buildCrmLeadUrl,
  formatLeadFields,
} from '../lead-delivery.types';

@Injectable()
export class TelegramDeliveryAdapter implements ILeadDeliveryAdapter {
  readonly type = 'telegram' as const;
  private readonly logger = new Logger(TelegramDeliveryAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async validate(
    credentials: Record<string, unknown>,
    config: Record<string, unknown>,
  ): Promise<LeadDeliveryValidationResult> {
    const botToken = String(credentials.botToken ?? '');
    if (!botToken) {
      return { ok: false, error: 'Укажите Bot Token' };
    }

    const fetchFn = this.config.get<typeof fetch>('CRM_HTTP_FETCH') ?? fetch;
    const response = await fetchFn(
      `https://api.telegram.org/bot${botToken}/getMe`,
    );
    const data = (await response.json()) as {
      ok: boolean;
      result?: { username?: string };
      description?: string;
    };

    if (!data.ok) {
      return { ok: false, error: data.description ?? 'Неверный Bot Token' };
    }

    const chatId = config.chatId ? String(config.chatId) : '';
    if (chatId) {
      const testResponse = await fetchFn(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '✅ Тестовое сообщение от AI Consultant. Бот подключён.',
          }),
        },
      );
      const testData = (await testResponse.json()) as {
        ok: boolean;
        description?: string;
      };
      if (!testData.ok) {
        return {
          ok: false,
          error:
            testData.description ??
            'Не удалось отправить в чат. Добавьте бота в группу или начните диалог.',
        };
      }
    }

    return {
      ok: true,
      details: { botUsername: data.result?.username ?? '' },
    };
  }

  async deliver(ctx: LeadDeliveryContext): Promise<void> {
    const botToken = String(ctx.credentials.botToken ?? '');
    const chatId = String(ctx.config.chatId ?? '');
    if (!botToken || !chatId) {
      throw new Error('Telegram: не задан bot token или chat_id');
    }

    const fields = formatLeadFields(ctx.lead);
    const crmUrl = buildCrmLeadUrl(ctx.webClientUrl, ctx.lead.id);
    const text = [
      ctx.test ? '🧪 *Тестовый лид*' : '🆕 *Новый лид*',
      '',
      `*Имя:* ${fields.firstName || '—'}`,
      `*Фамилия:* ${fields.lastName || '—'}`,
      `*Телефон:* ${fields.phone || '—'}`,
      `*Email:* ${fields.email || '—'}`,
      `*Источник:* ${fields.source}`,
      `*UTM:* ${fields.utm}`,
      '',
      `[Открыть в CRM](${crmUrl})`,
    ].join('\n');

    const fetchFn = this.config.get<typeof fetch>('CRM_HTTP_FETCH') ?? fetch;
    const response = await fetchFn(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      },
    );

    const data = (await response.json()) as {
      ok: boolean;
      description?: string;
    };
    if (!data.ok) {
      throw new Error(data.description ?? 'Ошибка Telegram API');
    }

    this.logger.log(`Telegram delivery sent for lead ${ctx.lead.id}`);
  }
}
