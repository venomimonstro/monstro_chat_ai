import { Injectable } from '@nestjs/common';
import {
  IntegrationStatus,
  IntegrationType,
  LeadDeliveryChannelType,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class CrmChannelProvisionerService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCrmChannels(tenantId: string): Promise<void> {
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
}
