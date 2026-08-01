import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SourceChannelConfig, SourceConfig } from '@ai-consultant/shared-types';
import { DEFAULT_SOURCE_CONFIG } from '@ai-consultant/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { CredentialCryptoService } from '../integrations/services/credential-crypto.service';
import type { ConnectTelegramChannelDto, ConnectVkChannelDto } from '@ai-consultant/shared-types';
import { Prisma } from '@prisma/client';

@Injectable()
export class ChannelsSetupService {
  private readonly logger = new Logger(ChannelsSetupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly config: ConfigService,
  ) {}

  getWebhookBaseUrl() {
    return this.config.get('API_PUBLIC_URL', 'http://localhost:3000');
  }

  async connectTelegram(
    tenantId: string,
    sourceId: string,
    dto: ConnectTelegramChannelDto,
  ) {
    const source = await this.getChannelSource(tenantId, sourceId, 'telegram');
    const fetchFn = this.config.get<typeof fetch>('CRM_HTTP_FETCH') ?? fetch;

    const meRes = await fetchFn(
      `https://api.telegram.org/bot${dto.botToken}/getMe`,
    );
    const meData = (await meRes.json()) as {
      ok: boolean;
      result?: { username?: string };
      description?: string;
    };
    if (!meData.ok) {
      throw new NotFoundException(meData.description ?? 'Неверный Bot Token');
    }

    const webhookUrl = `${this.getWebhookBaseUrl()}/api/channels/telegram/${source.widgetKey}/webhook`;
    const hookRes = await fetchFn(
      `https://api.telegram.org/bot${dto.botToken}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      },
    );
    const hookData = (await hookRes.json()) as { ok: boolean; description?: string };
    if (!hookData.ok) {
      throw new NotFoundException(
        hookData.description ?? 'Не удалось установить webhook',
      );
    }

    const config = this.getConfig(source.configJson);
    const next: SourceConfig = {
      ...config,
      channel: {
        ...config.channel,
        telegram: {
          botTokenEncrypted: this.crypto.encrypt(dto.botToken),
          botUsername: meData.result?.username,
        },
      },
    };

    await this.prisma.source.update({
      where: { id: source.id },
      data: { configJson: next as unknown as Prisma.InputJsonValue },
    });

    this.logger.log(`Telegram webhook set for source ${source.id}`);
    return {
      success: true,
      webhookUrl,
      botUsername: meData.result?.username,
    };
  }

  async connectVk(tenantId: string, sourceId: string, dto: ConnectVkChannelDto) {
    const source = await this.getChannelSource(tenantId, sourceId, 'vk');
    const config = this.getConfig(source.configJson);
    const next: SourceConfig = {
      ...config,
      channel: {
        ...config.channel,
        vk: {
          groupId: dto.groupId,
          accessTokenEncrypted: this.crypto.encrypt(dto.accessToken),
          confirmationCode: dto.confirmationCode,
        },
      },
    };

    await this.prisma.source.update({
      where: { id: source.id },
      data: { configJson: next as unknown as Prisma.InputJsonValue },
    });

    const webhookUrl = `${this.getWebhookBaseUrl()}/api/channels/vk/${source.widgetKey}/webhook`;
    return { success: true, webhookUrl };
  }

  decryptTelegramToken(configJson: unknown): string | null {
    const channel = this.getConfig(configJson).channel?.telegram;
    if (!channel?.botTokenEncrypted) return null;
    return this.crypto.decrypt(channel.botTokenEncrypted);
  }

  decryptVkToken(configJson: unknown): string | null {
    const channel = this.getConfig(configJson).channel?.vk;
    if (!channel?.accessTokenEncrypted) return null;
    return this.crypto.decrypt(channel.accessTokenEncrypted);
  }

  private async getChannelSource(
    tenantId: string,
    sourceId: string,
    type: 'telegram' | 'vk',
  ) {
    const source = await this.prisma.source.findFirst({
      where: { id: sourceId, tenantId, type },
    });
    if (!source) throw new NotFoundException('Источник канала не найден');
    return source;
  }

  private getConfig(configJson: unknown): SourceConfig {
    return (configJson as SourceConfig) ?? DEFAULT_SOURCE_CONFIG;
  }
}
