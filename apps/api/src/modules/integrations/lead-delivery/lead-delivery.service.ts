import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IntegrationStatus,
  IntegrationType,
  LeadDeliveryChannelType,
  Prisma,
  WebhookLogStatus,
} from '@prisma/client';
import type {
  LeadDeliveryChannelDto,
  LeadDeliveryConfig,
  LeadDeliveryLogDto,
} from '@ai-consultant/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';
import { CredentialCryptoService } from '../services/credential-crypto.service';
import { LeadDeliveryRegistryService } from './lead-delivery-registry.service';
import { LeadDeliveryQueueService } from './lead-delivery-queue.service';
import type { LeadDeliveryLeadData } from './lead-delivery.types';
import { TelegramDeliveryAdapter } from './adapters/telegram.adapter';
import {
  CreateLeadDeliveryChannelDto,
  UpdateLeadDeliveryChannelDto,
  ValidateTelegramDto,
} from './dto/lead-delivery.dto';

const CRM_TYPES: LeadDeliveryChannelType[] = [
  LeadDeliveryChannelType.amocrm,
  LeadDeliveryChannelType.bitrix24,
];

@Injectable()
export class LeadDeliveryService {
  private readonly logger = new Logger(LeadDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly registry: LeadDeliveryRegistryService,
    private readonly queue: LeadDeliveryQueueService,
    private readonly telegram: TelegramDeliveryAdapter,
    private readonly config: ConfigService,
  ) {}

  async listChannels(tenantId: string): Promise<LeadDeliveryChannelDto[]> {
    await this.ensureCrmChannels(tenantId);
    const rows = await this.prisma.leadDeliveryChannel.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toDto(row));
  }

  async getChannel(tenantId: string, id: string): Promise<LeadDeliveryChannelDto> {
    const row = await this.prisma.leadDeliveryChannel.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Канал доставки не найден');
    return this.toDto(row);
  }

  async createChannel(
    tenantId: string,
    dto: CreateLeadDeliveryChannelDto,
  ): Promise<LeadDeliveryChannelDto> {
    if (CRM_TYPES.includes(dto.type)) {
      throw new BadRequestException(
        'CRM-каналы создаются автоматически при подключении интеграции',
      );
    }

    if (dto.type === LeadDeliveryChannelType.telegram && !dto.botToken) {
      throw new BadRequestException('Укажите Bot Token для Telegram');
    }

    if (dto.type === LeadDeliveryChannelType.email) {
      const recipients = (dto.config?.recipients as string[] | undefined) ?? [];
      if (!recipients.length) {
        throw new BadRequestException('Укажите email-получателей');
      }
    }

    let credentialsEncrypted: string | undefined;
    let configJson = (dto.config ?? {}) as Prisma.InputJsonValue;

    if (dto.type === LeadDeliveryChannelType.telegram && dto.botToken) {
      const validation = await this.telegram.validate(
        { botToken: dto.botToken },
        dto.config ?? {},
      );
      if (!validation.ok) {
        throw new BadRequestException(validation.error ?? 'Неверный Bot Token');
      }
      credentialsEncrypted = this.crypto.encrypt(
        JSON.stringify({ botToken: dto.botToken }),
      );
      configJson = {
        ...((dto.config ?? {}) as object),
        botUsername: validation.details?.botUsername,
        hasToken: true,
      } as Prisma.InputJsonValue;
    }

    const row = await this.prisma.leadDeliveryChannel.create({
      data: {
        tenantId,
        type: dto.type,
        name: dto.name,
        enabled: dto.enabled ?? true,
        credentialsEncrypted,
        configJson,
      },
    });

    return this.toDto(row);
  }

  async updateChannel(
    tenantId: string,
    id: string,
    dto: UpdateLeadDeliveryChannelDto,
  ): Promise<LeadDeliveryChannelDto> {
    const existing = await this.prisma.leadDeliveryChannel.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Канал доставки не найден');

    const data: Prisma.LeadDeliveryChannelUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;

    const mergedConfig = {
      ...((existing.configJson ?? {}) as object),
      ...((dto.config ?? {}) as object),
    };

    if (dto.botToken && existing.type === LeadDeliveryChannelType.telegram) {
      const validation = await this.telegram.validate(
        { botToken: dto.botToken },
        mergedConfig,
      );
      if (!validation.ok) {
        throw new BadRequestException(validation.error ?? 'Неверный Bot Token');
      }
      data.credentialsEncrypted = this.crypto.encrypt(
        JSON.stringify({ botToken: dto.botToken }),
      );
      Object.assign(mergedConfig, {
        botUsername: validation.details?.botUsername,
        hasToken: true,
      });
    }

    if (dto.config || dto.botToken) {
      data.configJson = mergedConfig as Prisma.InputJsonValue;
    }

    const row = await this.prisma.leadDeliveryChannel.update({
      where: { id },
      data,
    });

    return this.toDto(row);
  }

  async deleteChannel(tenantId: string, id: string) {
    const existing = await this.prisma.leadDeliveryChannel.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException('Канал доставки не найден');
    if (CRM_TYPES.includes(existing.type)) {
      throw new BadRequestException('CRM-каналы нельзя удалить, только отключить');
    }
    await this.prisma.leadDeliveryChannel.delete({ where: { id } });
    return { ok: true };
  }

  async validateTelegram(dto: ValidateTelegramDto) {
    const result = await this.telegram.validate(
      { botToken: dto.botToken },
      { chatId: dto.chatId },
    );
    return result;
  }

  async saveGoogleCredentials(
    tenantId: string,
    channelId: string,
    tokens: { accessToken: string; refreshToken: string; expiresAt: number; mock?: boolean },
  ) {
    const channel = await this.prisma.leadDeliveryChannel.findFirst({
      where: { id: channelId, tenantId, type: LeadDeliveryChannelType.google_sheets },
    });
    if (!channel) throw new NotFoundException('Канал Google Sheets не найден');

    const config = (channel.configJson ?? {}) as Record<string, unknown>;
    const row = await this.prisma.leadDeliveryChannel.update({
      where: { id: channelId },
      data: {
        credentialsEncrypted: this.crypto.encrypt(JSON.stringify(tokens)),
        configJson: { ...config, connected: true } as Prisma.InputJsonValue,
      },
    });
    return this.toDto(row);
  }

  async listLogs(tenantId: string, limit = 30): Promise<LeadDeliveryLogDto[]> {
    const logs = await this.prisma.leadDeliveryLog.findMany({
      where: { tenantId },
      include: { channel: { select: { name: true, type: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      channelId: log.channelId,
      channelName: log.channel.name,
      channelType: log.channel.type as LeadDeliveryChannelDto['type'],
      leadId: log.leadId,
      status: log.status as LeadDeliveryLogDto['status'],
      errorMessage: log.errorMessage,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  async sendTest(tenantId: string, channelId: string) {
    const channel = await this.prisma.leadDeliveryChannel.findFirst({
      where: { id: channelId, tenantId },
    });
    if (!channel) throw new NotFoundException('Канал доставки не найден');

    const testLead = await this.buildTestLead(tenantId);
    await this.deliverToChannel(channel, testLead, true);
    return { ok: true };
  }

  async processDelivery(
    tenantId: string,
    leadId: string,
    channelId: string,
    test = false,
  ) {
    const channel = await this.prisma.leadDeliveryChannel.findFirst({
      where: { id: channelId, tenantId, enabled: true },
    });
    if (!channel) return;

    const existingSuccess = await this.prisma.leadDeliveryLog.findFirst({
      where: {
        channelId,
        leadId,
        status: WebhookLogStatus.success,
      },
    });
    if (!test && existingSuccess) {
      this.logger.log(`Delivery already succeeded: ${leadId}:${channelId}`);
      return;
    }

    const lead = test
      ? await this.buildTestLead(tenantId)
      : await this.loadLead(tenantId, leadId);
    if (!lead) return;

    await this.deliverToChannel(channel, lead, test);
  }

  private async deliverToChannel(
    channel: {
      id: string;
      tenantId: string;
      type: LeadDeliveryChannelType;
      credentialsEncrypted: string | null;
      configJson: unknown;
    },
    lead: LeadDeliveryLeadData,
    test: boolean,
  ) {
    const log = await this.prisma.leadDeliveryLog.create({
      data: {
        tenantId: channel.tenantId,
        channelId: channel.id,
        leadId: test ? null : lead.id,
        status: WebhookLogStatus.retrying,
      },
    });

    try {
      const adapter = this.registry.get(channel.type);
      const credentials = channel.credentialsEncrypted
        ? (JSON.parse(this.crypto.decrypt(channel.credentialsEncrypted)) as Record<
            string,
            unknown
          >)
        : {};

      if (CRM_TYPES.includes(channel.type)) {
        const integrationType =
          channel.type === LeadDeliveryChannelType.amocrm
            ? IntegrationType.amocrm
            : IntegrationType.bitrix24;
        const integration = await this.prisma.integration.findUnique({
          where: {
            tenantId_type: { tenantId: channel.tenantId, type: integrationType },
          },
        });
        if (!integration || integration.status !== IntegrationStatus.active) {
          await this.prisma.leadDeliveryLog.update({
            where: { id: log.id },
            data: {
              status: WebhookLogStatus.failed,
              errorMessage: 'CRM-интеграция не подключена',
            },
          });
          return;
        }
      }

      await adapter.deliver({
        channel: channel as never,
        lead,
        credentials,
        config: (channel.configJson ?? {}) as Record<string, unknown>,
        webClientUrl: this.config.get<string>(
          'WEB_CLIENT_URL',
          'http://localhost:5173',
        ),
        test,
      });

      await this.prisma.leadDeliveryLog.update({
        where: { id: log.id },
        data: { status: WebhookLogStatus.success },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Lead delivery failed ${channel.type} channel ${channel.id}: ${message}`,
      );
      await this.prisma.leadDeliveryLog.update({
        where: { id: log.id },
        data: {
          status: WebhookLogStatus.failed,
          errorMessage: message.slice(0, 500),
        },
      });
      throw error;
    }
  }

  private async loadLead(
    tenantId: string,
    leadId: string,
  ): Promise<LeadDeliveryLeadData | null> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId, archived: false },
      include: { source: { select: { name: true } } },
    });
    if (!lead) return null;
    return {
      id: lead.id,
      tenantId: lead.tenantId,
      dialogId: lead.dialogId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      utmJson: lead.utmJson,
      referrer: lead.referrer,
      landingPage: lead.landingPage,
      externalId: lead.externalId,
      externalCrmType: lead.externalCrmType,
      sourceName: lead.source?.name ?? null,
      createdAt: lead.createdAt,
    };
  }

  private async buildTestLead(tenantId: string): Promise<LeadDeliveryLeadData> {
    return {
      id: '00000000-0000-0000-0000-000000000001',
      tenantId,
      dialogId: '00000000-0000-0000-0000-000000000002',
      name: 'Иван Тестов',
      phone: '+7 (999) 123-45-67',
      email: 'test@example.com',
      utmJson: { utm_source: 'test', utm_campaign: 'sprint25' },
      referrer: 'https://example.com',
      landingPage: '/landing',
      externalId: null,
      externalCrmType: null,
      sourceName: 'Тестовый виджет',
      createdAt: new Date(),
    };
  }

  async ensureCrmChannels(tenantId: string) {
    const integrations = await this.prisma.integration.findMany({
      where: {
        tenantId,
        type: { in: [IntegrationType.amocrm, IntegrationType.bitrix24] },
      },
    });

    for (const integration of integrations) {
      const channelType =
        integration.type === IntegrationType.amocrm
          ? LeadDeliveryChannelType.amocrm
          : LeadDeliveryChannelType.bitrix24;
      const name =
        integration.type === IntegrationType.amocrm ? 'amoCRM' : 'Bitrix24';

      const existing = await this.prisma.leadDeliveryChannel.findFirst({
        where: { tenantId, type: channelType },
      });

      if (existing) continue;

      await this.prisma.leadDeliveryChannel.create({
        data: {
          tenantId,
          type: channelType,
          name,
          enabled: integration.status === IntegrationStatus.active,
          configJson: { instantDelivery: true },
        },
      });
    }
  }

  private toDto(row: {
    id: string;
    tenantId: string;
    type: LeadDeliveryChannelType;
    name: string;
    enabled: boolean;
    configJson: unknown;
    credentialsEncrypted?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): LeadDeliveryChannelDto {
    const config = (row.configJson ?? {}) as LeadDeliveryConfig;
    if (row.type === LeadDeliveryChannelType.telegram) {
      (config as { hasToken?: boolean }).hasToken = Boolean(row.credentialsEncrypted);
    }
    return {
      id: row.id,
      tenantId: row.tenantId,
      type: row.type as LeadDeliveryChannelDto['type'],
      name: row.name,
      enabled: row.enabled,
      config,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
