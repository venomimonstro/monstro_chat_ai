import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationType, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import type { CrmIntegrationConfig, CrmStatusMappingResponse } from '@ai-consultant/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';

type CrmProviderType = 'amocrm' | 'bitrix24';

@Injectable()
export class CrmStatusMappingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getMapping(
    tenantId: string,
    type: CrmProviderType,
  ): Promise<CrmStatusMappingResponse> {
    const integration = await this.getIntegration(tenantId, type);
    const config = (integration.configJson ?? {}) as CrmIntegrationConfig;
    const pipelineStatuses = await this.listDefaultPipelineStatuses(tenantId);
    const rows = await this.prisma.statusMapping.findMany({
      where: { integrationId: integration.id },
    });
    const byStatus = new Map(rows.map((row) => [row.internalStatusId, row]));

    return {
      bidirectionalSync: Boolean(config.bidirectionalSync),
      webhookUrl: this.buildWebhookUrl(tenantId, type),
      webhookSecret: config.webhookSecret ?? null,
      pipelineStatuses: pipelineStatuses.map((status) => ({
        id: status.id,
        name: status.name,
        sortOrder: status.sortOrder,
        color: status.color,
      })),
      mappings: pipelineStatuses.map((status) => ({
        internalStatusId: status.id,
        internalStatusName: status.name,
        externalStatusId: byStatus.get(status.id)?.externalStatusId ?? '',
      })),
    };
  }

  async saveMapping(
    tenantId: string,
    type: CrmProviderType,
    input: {
      bidirectionalSync: boolean;
      mappings: Array<{ internalStatusId: string; externalStatusId: string }>;
    },
  ) {
    const integration = await this.getIntegration(tenantId, type);
    const pipelineStatuses = await this.listDefaultPipelineStatuses(tenantId);
    const statusIds = new Set(pipelineStatuses.map((status) => status.id));

    if (input.bidirectionalSync) {
      this.assertCompleteMapping(pipelineStatuses, input.mappings);
    }

    for (const item of input.mappings) {
      if (!statusIds.has(item.internalStatusId)) {
        throw new BadRequestException('Статус не принадлежит воронке тенанта');
      }
    }

    const prevConfig = (integration.configJson ?? {}) as CrmIntegrationConfig;
    const nextConfig: CrmIntegrationConfig = {
      ...prevConfig,
      bidirectionalSync: input.bidirectionalSync,
      webhookSecret:
        prevConfig.webhookSecret ??
        randomBytes(24).toString('hex'),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.statusMapping.deleteMany({ where: { integrationId: integration.id } });
      const validMappings = input.mappings.filter((item) => item.externalStatusId.trim());
      if (validMappings.length) {
        await tx.statusMapping.createMany({
          data: validMappings.map((item) => ({
            integrationId: integration.id,
            internalStatusId: item.internalStatusId,
            externalStatusId: item.externalStatusId.trim(),
          })),
        });
      }
      await tx.integration.update({
        where: { id: integration.id },
        data: { configJson: nextConfig as Prisma.InputJsonValue },
      });
    });

    return this.getMapping(tenantId, type);
  }

  async resolveExternalStatusId(integrationId: string, internalStatusId: string) {
    const row = await this.prisma.statusMapping.findUnique({
      where: {
        integrationId_internalStatusId: {
          integrationId,
          internalStatusId,
        },
      },
    });
    return row?.externalStatusId ?? null;
  }

  async resolveInternalStatusId(
    integrationId: string,
    externalStatusId: string,
  ) {
    const row = await this.prisma.statusMapping.findFirst({
      where: { integrationId, externalStatusId },
    });
    return row?.internalStatusId ?? null;
  }

  isBidirectionalEnabled(config: CrmIntegrationConfig) {
    return Boolean(config.bidirectionalSync);
  }

  private assertCompleteMapping(
    pipelineStatuses: Array<{ id: string; name: string }>,
    mappings: Array<{ internalStatusId: string; externalStatusId: string }>,
  ) {
    const mapped = new Map(
      mappings.map((item) => [item.internalStatusId, item.externalStatusId.trim()]),
    );
    const missing = pipelineStatuses.filter(
      (status) => !mapped.get(status.id),
    );
    if (missing.length) {
      throw new BadRequestException(
        `Заполните маппинг для статусов: ${missing.map((s) => s.name).join(', ')}`,
      );
    }
  }

  private async listDefaultPipelineStatuses(tenantId: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { tenantId, isDefault: true },
      include: { statuses: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!pipeline) {
      throw new NotFoundException('Воронка не найдена');
    }
    return pipeline.statuses;
  }

  private buildWebhookUrl(tenantId: string, type: CrmProviderType) {
    const base = this.config.get<string>(
      'API_PUBLIC_URL',
      'http://localhost:3000/api',
    );
    const normalized = base.replace(/\/$/, '');
    const withApi = normalized.endsWith('/api') ? normalized : `${normalized}/api`;
    return `${withApi}/integrations/webhooks/${type}/${tenantId}`;
  }

  private async getIntegration(tenantId: string, type: CrmProviderType) {
    const integration = await this.prisma.integration.findUnique({
      where: { tenantId_type: { tenantId, type: type as IntegrationType } },
    });
    if (!integration || integration.status !== 'active') {
      throw new NotFoundException('Интеграция не подключена');
    }
    return integration;
  }
}
