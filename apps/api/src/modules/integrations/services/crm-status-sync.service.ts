import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IntegrationType,
  Prisma,
  WebhookDirection,
  WebhookLogStatus,
} from '@prisma/client';
import type { CrmIntegrationConfig } from '@ai-consultant/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';
import { CredentialCryptoService } from './credential-crypto.service';
import { CrmStatusMappingService } from './crm-status-mapping.service';
import { CrmSyncLockService } from './crm-sync-lock.service';
import type { CrmOAuthTokens } from './crm-export.service';

export interface CrmStatusPushPayload {
  tenantId: string;
  leadId: string;
  statusId: string;
}

export interface CrmInboundStatusPayload {
  tenantId: string;
  integrationType: IntegrationType;
  externalId: string;
  externalStatusId: string;
  updatedAt: string;
}

@Injectable()
export class CrmStatusSyncService {
  private readonly logger = new Logger(CrmStatusSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly statusMapping: CrmStatusMappingService,
    private readonly syncLock: CrmSyncLockService,
    private readonly config: ConfigService,
  ) {}

  verifyWebhookSecret(
    config: CrmIntegrationConfig,
    provided?: string,
  ) {
    if (!config.webhookSecret) {
      throw new UnauthorizedException('Webhook secret не настроен');
    }
    if (!provided || provided !== config.webhookSecret) {
      throw new UnauthorizedException('Неверный webhook secret');
    }
  }

  async handleInboundWebhook(
    tenantId: string,
    integrationType: IntegrationType,
    secret: string | undefined,
    payload: Omit<CrmInboundStatusPayload, 'tenantId' | 'integrationType'>,
  ) {
    const integration = await this.prisma.integration.findUnique({
      where: {
        tenantId_type: { tenantId, type: integrationType },
      },
    });
    if (!integration) {
      throw new UnauthorizedException('Интеграция не найдена');
    }
    this.verifyWebhookSecret(
      (integration.configJson ?? {}) as CrmIntegrationConfig,
      secret,
    );
    return this.applyStatusInbound({
      tenantId,
      integrationType,
      ...payload,
    });
  }

  async pushStatusOutbound(payload: CrmStatusPushPayload) {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: payload.leadId,
        tenantId: payload.tenantId,
        archived: false,
      },
      include: { status: true },
    });
    if (!lead?.externalId || !lead.externalCrmType) return;

    const integration = await this.prisma.integration.findUnique({
      where: {
        tenantId_type: {
          tenantId: payload.tenantId,
          type: lead.externalCrmType,
        },
      },
    });
    if (!integration || integration.status !== 'active') return;

    const config = (integration.configJson ?? {}) as CrmIntegrationConfig;
    if (!this.statusMapping.isBidirectionalEnabled(config)) return;

    const externalStatusId = await this.statusMapping.resolveExternalStatusId(
      integration.id,
      payload.statusId,
    );
    if (!externalStatusId) {
      this.logger.warn(`No external status mapping for ${payload.statusId}`);
      return;
    }

    const lockHeld = await this.syncLock.acquire(lead.id, 'internal');
    const currentOrigin = await this.syncLock.getOrigin(lead.id);
    if (!lockHeld && currentOrigin === 'external') {
      this.logger.log(`Skip outbound status for lead ${lead.id}: external lock active`);
      return;
    }
    if (!lockHeld) {
      await this.syncLock.refresh(lead.id, 'internal');
    }

    const log = await this.prisma.webhookLog.create({
      data: {
        tenantId: payload.tenantId,
        integrationId: integration.id,
        leadId: lead.id,
        direction: WebhookDirection.out,
        status: WebhookLogStatus.retrying,
        payloadJson: {
          action: 'status_push',
          externalStatusId,
          internalStatusId: payload.statusId,
        },
      },
    });

    try {
      const tokens = this.readTokens(integration.credentialsEncrypted);
      await this.updateExternalStatus(
        lead.externalCrmType,
        tokens,
        lead.externalId,
        externalStatusId,
      );
      await this.prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          status: WebhookLogStatus.success,
          payloadJson: {
            action: 'status_push',
            externalStatusId,
            externalId: lead.externalId,
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          status: WebhookLogStatus.failed,
          errorMessage: message,
          retryCount: { increment: 1 },
        },
      });
      throw error;
    } finally {
      await this.syncLock.release(lead.id);
    }
  }

  async applyStatusInbound(payload: CrmInboundStatusPayload) {
    const integration = await this.prisma.integration.findUnique({
      where: {
        tenantId_type: {
          tenantId: payload.tenantId,
          type: payload.integrationType,
        },
      },
    });
    if (!integration || integration.status !== 'active') return { applied: false };

    const config = (integration.configJson ?? {}) as CrmIntegrationConfig;
    if (!this.statusMapping.isBidirectionalEnabled(config)) {
      return { applied: false, reason: 'bidirectional_disabled' };
    }

    const lead = await this.prisma.lead.findFirst({
      where: {
        tenantId: payload.tenantId,
        externalId: payload.externalId,
        externalCrmType: payload.integrationType,
        archived: false,
      },
    });
    if (!lead) return { applied: false, reason: 'lead_not_found' };

    const internalStatusId = await this.statusMapping.resolveInternalStatusId(
      integration.id,
      payload.externalStatusId,
    );
    if (!internalStatusId) {
      return { applied: false, reason: 'status_not_mapped' };
    }

    const inboundAt = new Date(payload.updatedAt);
    if (
      lead.updatedAt.getTime() > inboundAt.getTime() &&
      lead.statusId !== internalStatusId
    ) {
      await this.prisma.webhookLog.create({
        data: {
          tenantId: payload.tenantId,
          integrationId: integration.id,
          leadId: lead.id,
          direction: WebhookDirection.in,
          status: WebhookLogStatus.failed,
          errorMessage: 'overwritten_by_internal_change',
          payloadJson: payload as unknown as Prisma.InputJsonValue,
        },
      });
      return { applied: false, reason: 'overwritten' };
    }

    if (lead.statusId === internalStatusId) {
      return { applied: false, reason: 'no_change' };
    }

    const lockHeld = await this.syncLock.acquire(lead.id, 'external');
    const currentOrigin = await this.syncLock.getOrigin(lead.id);
    if (!lockHeld && currentOrigin === 'internal') {
      await this.prisma.webhookLog.create({
        data: {
          tenantId: payload.tenantId,
          integrationId: integration.id,
          leadId: lead.id,
          direction: WebhookDirection.in,
          status: WebhookLogStatus.failed,
          errorMessage: 'skipped_due_to_internal_lock',
          payloadJson: payload as unknown as Prisma.InputJsonValue,
        },
      });
      return { applied: false, reason: 'internal_lock' };
    }
    if (!lockHeld) {
      await this.syncLock.refresh(lead.id, 'external');
    }

    const status = await this.prisma.pipelineStatus.findFirst({
      where: { id: internalStatusId, pipeline: { tenantId: payload.tenantId } },
    });
    if (!status) return { applied: false, reason: 'invalid_status' };

    await this.prisma.$transaction([
      this.prisma.lead.update({
        where: { id: lead.id },
        data: {
          statusId: internalStatusId,
          pipelineId: status.pipelineId,
        },
      }),
      this.prisma.leadStatusHistory.create({
        data: {
          tenantId: payload.tenantId,
          leadId: lead.id,
          fromStatusId: lead.statusId,
          toStatusId: internalStatusId,
        },
      }),
      this.prisma.webhookLog.create({
        data: {
          tenantId: payload.tenantId,
          integrationId: integration.id,
          leadId: lead.id,
          direction: WebhookDirection.in,
          status: WebhookLogStatus.success,
          payloadJson: payload as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);

    await this.syncLock.release(lead.id);
    return { applied: true, leadId: lead.id, statusId: internalStatusId };
  }

  private readTokens(credentialsEncrypted: string | null): CrmOAuthTokens {
    if (!credentialsEncrypted) {
      throw new Error('Отсутствуют OAuth-токены интеграции');
    }
    return JSON.parse(this.crypto.decrypt(credentialsEncrypted)) as CrmOAuthTokens;
  }

  private async updateExternalStatus(
    type: IntegrationType,
    tokens: CrmOAuthTokens,
    externalId: string,
    externalStatusId: string,
  ) {
    if (tokens.mock) return;

    const fetchFn = this.config.get<typeof fetch>('CRM_HTTP_FETCH') ?? fetch;

    if (type === IntegrationType.amocrm) {
      const domain = tokens.accountDomain;
      if (!domain) throw new Error('Не задан домен amoCRM');
      const response = await fetchFn(
        `https://${domain}/api/v4/leads/${externalId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status_id: Number(externalStatusId) }),
        },
      );
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`amoCRM status API ${response.status}: ${text.slice(0, 200)}`);
      }
      return;
    }

    if (type === IntegrationType.bitrix24) {
      const domain = tokens.portalDomain;
      if (!domain) throw new Error('Не задан домен Bitrix24');
      const response = await fetchFn(
        `https://${domain}/rest/crm.lead.update.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: externalId,
            fields: { STATUS_ID: externalStatusId },
          }),
        },
      );
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Bitrix24 status API ${response.status}: ${text.slice(0, 200)}`);
      }
    }
  }
}
