import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationType } from '@prisma/client';
import type {
  Ga4IntegrationConfig,
  MetrikaIntegrationConfig,
} from '@ai-consultant/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';

export type ConversionEventType = 'lead_created' | 'deal_won';

export interface ConversionLeadContext {
  id: string;
  yandexClientId: string | null;
  gaClientId: string | null;
  phone: string | null;
  email: string | null;
}

const DEFAULT_DEAL_WON_STATUS_NAMES = ['Продажа', 'Закрыт'];

@Injectable()
export class ConversionTrackingService {
  private readonly logger = new Logger(ConversionTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isDealWonStatus(
    statusName: string,
    configuredNames?: string[],
  ): boolean {
    const names = configuredNames?.length
      ? configuredNames
      : DEFAULT_DEAL_WON_STATUS_NAMES;
    return names.some(
      (name) => name.toLowerCase() === statusName.toLowerCase(),
    );
  }

  async trackLeadCreated(tenantId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });
    if (!lead) return;
    await this.dispatch(tenantId, 'lead_created', lead);
  }

  async trackDealWon(tenantId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });
    if (!lead) return;
    await this.dispatch(tenantId, 'deal_won', lead);
  }

  private async dispatch(
    tenantId: string,
    eventType: ConversionEventType,
    lead: ConversionLeadContext,
  ) {
    const integrations = await this.prisma.integration.findMany({
      where: { tenantId, status: 'active' },
    });

    for (const integration of integrations) {
      if (integration.type === IntegrationType.metrika) {
        await this.sendMetrika(integration.configJson, eventType, lead);
      }
      if (integration.type === IntegrationType.ga4) {
        await this.sendGa4(integration.configJson, eventType, lead);
      }
    }
  }

  private resolveEventName(
    eventType: ConversionEventType,
    mapping?: Record<string, string>,
  ) {
    return mapping?.[eventType] ?? eventType;
  }

  private async sendMetrika(
    rawConfig: unknown,
    eventType: ConversionEventType,
    lead: ConversionLeadContext,
  ) {
    const config = rawConfig as MetrikaIntegrationConfig;
    if (!config.counterId || !config.oauthToken) return;
    if (eventType === 'lead_created' && !config.events?.leadCreated) return;
    if (eventType === 'deal_won' && !config.events?.dealWon) return;
    if (!lead.yandexClientId) {
      this.logger.warn(`Metrika ${eventType}: missing yandexClientId for lead ${lead.id}`);
      return;
    }

    const target = this.resolveEventName(eventType, config.eventMapping);
    const dateTime = Math.floor(Date.now() / 1000);
    const csv = `ClientId,Target,DateTime\n${lead.yandexClientId},${target},${dateTime}\n`;
    const url = `https://api-metrika.yandex.net/management/v1/counter/${config.counterId}/offline_conversions/upload?client_id_type=CLIENT_ID`;

    await this.post(url, {
      headers: {
        Authorization: `OAuth ${config.oauthToken}`,
        'Content-Type': 'text/csv',
      },
      body: csv,
    });
  }

  private async sendGa4(
    rawConfig: unknown,
    eventType: ConversionEventType,
    lead: ConversionLeadContext,
  ) {
    const config = rawConfig as Ga4IntegrationConfig;
    if (!config.measurementId || !config.apiSecret) return;
    if (eventType === 'lead_created' && !config.events?.leadCreated) return;
    if (eventType === 'deal_won' && !config.events?.dealWon) return;
    if (!lead.gaClientId) {
      this.logger.warn(`GA4 ${eventType}: missing gaClientId for lead ${lead.id}`);
      return;
    }

    const eventName = this.resolveEventName(eventType, config.eventMapping);
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(config.measurementId)}&api_secret=${encodeURIComponent(config.apiSecret)}`;

    await this.post(url, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: lead.gaClientId,
        events: [
          {
            name: eventName,
            params: {
              lead_id: lead.id,
              phone: lead.phone ?? undefined,
              email: lead.email ?? undefined,
            },
          },
        ],
      }),
    });
  }

  private async post(
    url: string,
    init: { headers: Record<string, string>; body: string },
  ) {
    const customFetch = this.config.get<typeof fetch>('CONVERSION_FETCH');
    const fetchFn = customFetch ?? fetch;
    const response = await fetchFn(url, {
      method: 'POST',
      headers: init.headers,
      body: init.body,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.warn(
        `Conversion upload failed (${response.status}): ${text.slice(0, 200)}`,
      );
    }
  }
}
