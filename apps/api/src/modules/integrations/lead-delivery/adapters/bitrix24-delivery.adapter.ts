import { Injectable, Logger } from '@nestjs/common';
import { IntegrationType } from '@prisma/client';
import type { ILeadDeliveryAdapter, LeadDeliveryContext } from '../lead-delivery.types';
import { CrmExportService } from '../../services/crm-export.service';

@Injectable()
export class Bitrix24DeliveryAdapter implements ILeadDeliveryAdapter {
  readonly type = 'bitrix24' as const;
  private readonly logger = new Logger(Bitrix24DeliveryAdapter.name);

  constructor(private readonly crmExport: CrmExportService) {}

  async deliver(ctx: LeadDeliveryContext): Promise<void> {
    if (ctx.config.instantDelivery === false) return;

    if (
      ctx.lead.externalId &&
      ctx.lead.externalCrmType === IntegrationType.bitrix24
    ) {
      this.logger.log(`Bitrix24: lead ${ctx.lead.id} already synced, skip`);
      return;
    }

    if (ctx.test) {
      this.logger.log(`[TEST] Bitrix24 delivery for lead ${ctx.lead.id}`);
      return;
    }

    await this.crmExport.exportLead({
      tenantId: ctx.lead.tenantId,
      leadId: ctx.lead.id,
      integrationType: IntegrationType.bitrix24,
    });
  }
}
