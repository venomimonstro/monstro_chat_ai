import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationType, WebhookDirection, WebhookLogStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CredentialCryptoService } from './credential-crypto.service';
import { CrmFieldMappingService } from './crm-field-mapping.service';
import { toAttributionDto } from '../attribution.util';
import type { InternalCrmField } from '../constants';

export interface CrmOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accountDomain?: string;
  portalDomain?: string;
  mock?: boolean;
}

export interface CrmExportPayload {
  tenantId: string;
  leadId: string;
  integrationType: IntegrationType;
}

@Injectable()
export class CrmExportService {
  private readonly logger = new Logger(CrmExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly fieldMapping: CrmFieldMappingService,
    private readonly config: ConfigService,
  ) {}

  async exportLead(payload: CrmExportPayload) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: payload.leadId, tenantId: payload.tenantId, archived: false },
    });
    if (!lead) return;

    const integration = await this.prisma.integration.findUnique({
      where: {
        tenantId_type: {
          tenantId: payload.tenantId,
          type: payload.integrationType,
        },
      },
    });
    if (!integration || integration.status !== 'active') return;

    const log = await this.prisma.webhookLog.create({
      data: {
        tenantId: payload.tenantId,
        integrationId: integration.id,
        leadId: lead.id,
        direction: WebhookDirection.out,
        status: WebhookLogStatus.retrying,
        payloadJson: { integrationType: payload.integrationType },
      },
    });

    try {
      const tokens = this.readTokens(integration.credentialsEncrypted);
      const fieldMap = await this.fieldMapping.resolveMap(
        integration.id,
        integration.type,
      );
      const values = this.buildValues(lead, fieldMap);
      const externalId = await this.pushToExternalCrm(
        integration.type,
        tokens,
        values,
      );

      await this.prisma.$transaction([
        this.prisma.lead.update({
          where: { id: lead.id },
          data: {
            externalId: String(externalId),
            externalCrmType: integration.type,
            syncStatus: 'synced',
            syncError: null,
            lastSyncAt: new Date(),
          },
        }),
        this.prisma.webhookLog.update({
          where: { id: log.id },
          data: {
            status: WebhookLogStatus.success,
            payloadJson: { externalId, values },
          },
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`CRM export failed for lead ${lead.id}: ${message}`);
      await this.prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          status: WebhookLogStatus.failed,
          errorMessage: message,
          retryCount: { increment: 1 },
        },
      });
      throw error;
    }
  }

  async markLeadFailed(leadId: string, message: string) {
    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        syncStatus: 'failed',
        syncError: message,
        lastSyncAt: new Date(),
      },
    });
  }

  private readTokens(credentialsEncrypted: string | null): CrmOAuthTokens {
    if (!credentialsEncrypted) {
      throw new Error('Отсутствуют OAuth-токены интеграции');
    }
    return JSON.parse(this.crypto.decrypt(credentialsEncrypted)) as CrmOAuthTokens;
  }

  private buildValues(
    lead: {
      name: string | null;
      phone: string | null;
      email: string | null;
      notes: string | null;
      utmJson: unknown;
      referrer: string | null;
      landingPage: string | null;
    },
    fieldMap: Record<InternalCrmField, string>,
  ) {
    const attribution = toAttributionDto({
      utmJson: lead.utmJson,
      referrer: lead.referrer,
      landingPage: lead.landingPage,
      yandexClientId: null,
      gaClientId: null,
    });
    const source: Record<string, string | null | undefined> = {
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      notes: lead.notes,
      utm_source: attribution.utmSource,
      utm_campaign: attribution.utmCampaign,
      referrer: attribution.referrer,
      landing_page: attribution.landingPage,
    };

    const mapped: Record<string, string> = {};
    for (const [internal, external] of Object.entries(fieldMap)) {
      const value = source[internal];
      if (value) mapped[external] = value;
    }
    return mapped;
  }

  private async pushToExternalCrm(
    type: IntegrationType,
    tokens: CrmOAuthTokens,
    values: Record<string, string>,
  ): Promise<string | number> {
    const fetchFn = this.config.get<typeof fetch>('CRM_HTTP_FETCH') ?? fetch;

    if (tokens.mock) {
      return `mock-${type}-${Date.now()}`;
    }

    if (type === IntegrationType.amocrm) {
      const domain = tokens.accountDomain;
      if (!domain) throw new Error('Не задан домен amoCRM');
      const response = await fetchFn(`https://${domain}/api/v4/leads`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            name: values.name ?? values.NAME ?? 'Новый лид',
            _embedded: {
              contacts: [
                {
                  name: values.name ?? 'Контакт',
                  custom_fields_values: [
                    values.PHONE
                      ? {
                          field_code: 'PHONE',
                          values: [{ value: values.PHONE, enum_code: 'WORK' }],
                        }
                      : null,
                    values.EMAIL
                      ? {
                          field_code: 'EMAIL',
                          values: [{ value: values.EMAIL, enum_code: 'WORK' }],
                        }
                      : null,
                  ].filter(Boolean),
                },
              ],
            },
          },
        ]),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`amoCRM API ${response.status}: ${text.slice(0, 200)}`);
      }
      const data = (await response.json()) as {
        _embedded?: { leads?: Array<{ id: number }> };
      };
      const id = data._embedded?.leads?.[0]?.id;
      if (!id) throw new Error('amoCRM не вернул ID сделки');
      return id;
    }

    if (type === IntegrationType.bitrix24) {
      const domain = tokens.portalDomain;
      if (!domain) throw new Error('Не задан домен Bitrix24');
      const fields: Record<string, string> = {
        TITLE: values.TITLE ?? values.name ?? 'Новый лид',
      };
      if (values.PHONE) fields.PHONE = [{ VALUE: values.PHONE, VALUE_TYPE: 'WORK' }] as never;
      if (values.EMAIL) fields.EMAIL = [{ VALUE: values.EMAIL, VALUE_TYPE: 'WORK' }] as never;
      if (values.COMMENTS) fields.COMMENTS = values.COMMENTS;

      const response = await fetchFn(
        `https://${domain}/rest/crm.lead.add.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fields }),
        },
      );
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Bitrix24 API ${response.status}: ${text.slice(0, 200)}`);
      }
      const data = (await response.json()) as { result?: number };
      if (!data.result) throw new Error('Bitrix24 не вернул ID лида');
      return data.result;
    }

    throw new Error(`Неподдерживаемый тип CRM: ${type}`);
  }
}
