import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IntegrationType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CRM_EXPORT_MAX_ATTEMPTS,
  QUEUE_CRM_EXPORT,
} from '../constants';
import type { CrmExportPayload } from './crm-export.service';

@Injectable()
export class CrmSyncService {
  private readonly logger = new Logger(CrmSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_CRM_EXPORT) private readonly exportQueue: Queue,
  ) {}

  async enqueueLeadExport(tenantId: string, leadId: string) {
    const integrations = await this.prisma.integration.findMany({
      where: {
        tenantId,
        status: 'active',
        type: { in: [IntegrationType.amocrm, IntegrationType.bitrix24] },
      },
    });
    if (!integrations.length) return;

    await this.prisma.lead.update({
      where: { id: leadId },
      data: { syncStatus: 'pending', syncError: null },
    });

    for (const integration of integrations) {
      const payload: CrmExportPayload = {
        tenantId,
        leadId,
        integrationType: integration.type,
      };
      await this.exportQueue.add('export-lead', payload, {
        jobId: `${leadId}:${integration.type}`,
        attempts: CRM_EXPORT_MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 200,
        removeOnFail: 100,
      });
      this.logger.log(
        `Queued CRM export for lead ${leadId} (${integration.type})`,
      );
    }
  }

  async retryLeadExport(tenantId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId, archived: false },
    });
    if (!lead) return;
    await this.enqueueLeadExport(tenantId, leadId);
  }

  async listSyncErrors(tenantId: string, limit = 20) {
    const logs = await this.prisma.webhookLog.findMany({
      where: {
        tenantId,
        status: 'failed',
        direction: 'out',
      },
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        integration: { select: { type: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return logs.map((log) => ({
      id: log.id,
      leadId: log.leadId,
      leadName: log.lead?.name ?? null,
      leadPhone: log.lead?.phone ?? null,
      integrationType: log.integration?.type ?? null,
      errorMessage: log.errorMessage,
      retryCount: log.retryCount,
      updatedAt: log.updatedAt.toISOString(),
    }));
  }
}
