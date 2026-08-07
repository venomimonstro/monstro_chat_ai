import { Injectable } from '@nestjs/common';
import { IntegrationStatus, IntegrationType, Prisma } from '@prisma/client';
import type {
  ConversionEventsConfig,
  Ga4IntegrationConfig,
  GtmIntegrationConfig,
  IntegrationDto,
  IntegrationsOverviewDto,
  MetrikaIntegrationConfig,
} from '@ai-consultant/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UpsertGa4IntegrationDto,
  UpsertGtmIntegrationDto,
  UpsertMetrikaIntegrationDto,
} from './dto/integrations.dto';

const DEFAULT_EVENTS: ConversionEventsConfig = {
  leadCreated: true,
  dealWon: true,
};

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  getStatus() {
    return { status: 'ok', sprint: 25 };
  }

  async getOverview(tenantId: string): Promise<IntegrationsOverviewDto> {
    const rows = await this.prisma.integration.findMany({
      where: { tenantId },
      take: 1000,
    });

    const byType = new Map(rows.map((row) => [row.type, row]));
    return {
      metrika: byType.has(IntegrationType.metrika)
        ? this.toDto(byType.get(IntegrationType.metrika)!)
        : null,
      gtm: byType.has(IntegrationType.gtm)
        ? this.toDto(byType.get(IntegrationType.gtm)!)
        : null,
      ga4: byType.has(IntegrationType.ga4)
        ? this.toDto(byType.get(IntegrationType.ga4)!)
        : null,
      amocrm: byType.has(IntegrationType.amocrm)
        ? this.toDto(byType.get(IntegrationType.amocrm)!)
        : null,
      bitrix24: byType.has(IntegrationType.bitrix24)
        ? this.toDto(byType.get(IntegrationType.bitrix24)!)
        : null,
    };
  }

  async upsertMetrika(tenantId: string, dto: UpsertMetrikaIntegrationDto) {
    const existing = await this.prisma.integration.findUnique({
      where: { tenantId_type: { tenantId, type: IntegrationType.metrika } },
    });
    const prev = (existing?.configJson ?? {}) as MetrikaIntegrationConfig;

    const config: MetrikaIntegrationConfig = {
      counterId: dto.counterId,
      oauthToken: dto.oauthToken ?? prev.oauthToken,
      events: { ...DEFAULT_EVENTS, ...prev.events, ...dto.events },
      dealWonStatusNames: dto.dealWonStatusNames ?? prev.dealWonStatusNames,
      eventMapping: dto.eventMapping ?? prev.eventMapping,
    };

    const row = await this.prisma.integration.upsert({
      where: { tenantId_type: { tenantId, type: IntegrationType.metrika } },
      create: {
        tenantId,
        type: IntegrationType.metrika,
        status: dto.status ?? IntegrationStatus.active,
        configJson: config as Prisma.InputJsonValue,
      },
      update: {
        status: dto.status ?? IntegrationStatus.active,
        configJson: config as Prisma.InputJsonValue,
      },
    });

    return this.toDto(row);
  }

  async upsertGtm(tenantId: string, dto: UpsertGtmIntegrationDto) {
    const config: GtmIntegrationConfig = { containerId: dto.containerId };
    const row = await this.prisma.integration.upsert({
      where: { tenantId_type: { tenantId, type: IntegrationType.gtm } },
      create: {
        tenantId,
        type: IntegrationType.gtm,
        status: dto.status ?? IntegrationStatus.active,
        configJson: config as Prisma.InputJsonValue,
      },
      update: {
        status: dto.status ?? IntegrationStatus.active,
        configJson: config as Prisma.InputJsonValue,
      },
    });
    return this.toDto(row);
  }

  async upsertGa4(tenantId: string, dto: UpsertGa4IntegrationDto) {
    const existing = await this.prisma.integration.findUnique({
      where: { tenantId_type: { tenantId, type: IntegrationType.ga4 } },
    });
    const prev = (existing?.configJson ?? {}) as Ga4IntegrationConfig;

    const config: Ga4IntegrationConfig = {
      measurementId: dto.measurementId,
      apiSecret: dto.apiSecret,
      events: { ...DEFAULT_EVENTS, ...prev.events, ...dto.events },
      dealWonStatusNames: dto.dealWonStatusNames ?? prev.dealWonStatusNames,
      eventMapping: dto.eventMapping ?? prev.eventMapping,
    };

    const row = await this.prisma.integration.upsert({
      where: { tenantId_type: { tenantId, type: IntegrationType.ga4 } },
      create: {
        tenantId,
        type: IntegrationType.ga4,
        status: dto.status ?? IntegrationStatus.active,
        configJson: config as Prisma.InputJsonValue,
      },
      update: {
        status: dto.status ?? IntegrationStatus.active,
        configJson: config as Prisma.InputJsonValue,
      },
    });

    return this.toDto(row);
  }

  private toDto(row: {
    id: string;
    tenantId: string;
    type: IntegrationType;
    status: IntegrationStatus;
    configJson: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): IntegrationDto {
    const config = { ...(row.configJson as Record<string, unknown>) };
    if (config.oauthToken) {
      config.oauthToken = '***';
    }
    if (config.apiSecret) {
      config.apiSecret = '***';
    }

    return {
      id: row.id,
      tenantId: row.tenantId,
      type: row.type,
      status: row.status,
      config: config as IntegrationDto['config'],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
