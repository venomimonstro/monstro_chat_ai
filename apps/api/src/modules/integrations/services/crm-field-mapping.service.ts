import { Injectable, NotFoundException } from '@nestjs/common';
import { IntegrationType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DEFAULT_AMOCRM_FIELD_MAPPING,
  DEFAULT_BITRIX24_FIELD_MAPPING,
  INTERNAL_CRM_FIELDS,
  type InternalCrmField,
} from '../constants';

export interface FieldMappingItem {
  internalField: string;
  externalField: string;
}

@Injectable()
export class CrmFieldMappingService {
  constructor(private readonly prisma: PrismaService) {}

  getAvailableInternalFields() {
    return INTERNAL_CRM_FIELDS.map((field) => ({
      field,
      label: field,
    }));
  }

  getDefaultExternalFields(type: IntegrationType) {
    const defaults =
      type === IntegrationType.bitrix24
        ? DEFAULT_BITRIX24_FIELD_MAPPING
        : DEFAULT_AMOCRM_FIELD_MAPPING;
    return INTERNAL_CRM_FIELDS.map((field) => ({
      internalField: field,
      externalField: defaults[field],
    }));
  }

  async list(tenantId: string, type: IntegrationType) {
    const integration = await this.getIntegration(tenantId, type);
    const rows = await this.prisma.fieldMapping.findMany({
      where: { integrationId: integration.id },
      orderBy: { internalField: 'asc' },
    });
    if (!rows.length) {
      return this.getDefaultExternalFields(type);
    }
    return rows.map((row) => ({
      internalField: row.internalField,
      externalField: row.externalField,
    }));
  }

  async save(
    tenantId: string,
    type: IntegrationType,
    mappings: FieldMappingItem[],
  ) {
    const integration = await this.getIntegration(tenantId, type);
    await this.prisma.$transaction(async (tx) => {
      await tx.fieldMapping.deleteMany({ where: { integrationId: integration.id } });
      if (mappings.length) {
        await tx.fieldMapping.createMany({
          data: mappings.map((item) => ({
            integrationId: integration.id,
            internalField: item.internalField,
            externalField: item.externalField,
          })),
        });
      }
    });
    return this.list(tenantId, type);
  }

  async resolveMap(
    integrationId: string,
    type: IntegrationType,
  ): Promise<Record<InternalCrmField, string>> {
    const rows = await this.prisma.fieldMapping.findMany({
      where: { integrationId },
    });
    const defaults =
      type === IntegrationType.bitrix24
        ? DEFAULT_BITRIX24_FIELD_MAPPING
        : DEFAULT_AMOCRM_FIELD_MAPPING;
    const map = { ...defaults };
    for (const row of rows) {
      if (INTERNAL_CRM_FIELDS.includes(row.internalField as InternalCrmField)) {
        map[row.internalField as InternalCrmField] = row.externalField;
      }
    }
    return map;
  }

  private async getIntegration(tenantId: string, type: IntegrationType) {
    const integration = await this.prisma.integration.findUnique({
      where: { tenantId_type: { tenantId, type } },
    });
    if (!integration) {
      throw new NotFoundException('Интеграция не подключена');
    }
    return integration;
  }
}
