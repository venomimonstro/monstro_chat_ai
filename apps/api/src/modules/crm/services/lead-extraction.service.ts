import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import type { SourceConfig } from '@ai-consultant/shared-types';
import { NerService } from './ner.service';
import { PipelinesService } from './pipelines.service';
import { ConversionTrackingService } from '../../integrations/services/conversion-tracking.service';
import { LeadDeliveryQueueService } from '../../integrations/lead-delivery/lead-delivery-queue.service';
import { OutgoingWebhookService } from '../../integrations/outgoing-webhook/outgoing-webhook.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CrmGateway } from '../crm.gateway';
import { PromptExperimentService } from '../../prompts/prompt-experiment.service';
import { PushService } from '../../push/push.service';
import { leadAttributionFromDialog } from '../../integrations/attribution.util';
import {
  leadGoalInstruction,
  missingLeadFields,
  resolveLeadProfileMode,
  type LeadField,
} from '../utils/lead-profile.util';

@Injectable()
export class LeadExtractionService {
  private readonly logger = new Logger(LeadExtractionService.name);
  private readonly dedupeDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ner: NerService,
    private readonly pipelines: PipelinesService,
    private readonly conversionTracking: ConversionTrackingService,
    private readonly leadDelivery: LeadDeliveryQueueService,
    private readonly outgoingWebhook: OutgoingWebhookService,
    private readonly notifications: NotificationsService,
    private readonly crmGateway: CrmGateway,
    private readonly promptExperiments: PromptExperimentService,
    private readonly push: PushService,
    config: ConfigService,
  ) {
    this.dedupeDays = config.get<number>('LEAD_DEDUPE_DAYS', 30);
  }

  async getLeadState(params: {
    tenantId: string;
    dialogId: string;
    sourceConfig: SourceConfig;
  }): Promise<{
    mode: ReturnType<typeof resolveLeadProfileMode>;
    missing: LeadField[];
    hasLead: boolean;
    instruction: string | null;
  }> {
    const config = params.sourceConfig.ai?.leadExtraction;
    if (config?.enabled === false) {
      return {
        mode: 'phone',
        missing: [],
        hasLead: false,
        instruction: null,
      };
    }

    const mode = resolveLeadProfileMode(config);
    const existing = await this.prisma.lead.findUnique({
      where: { dialogId: params.dialogId },
    });
    if (existing) {
      return { mode, missing: [], hasLead: true, instruction: null };
    }

    const accumulated = await this.accumulateFromHistory(
      params.dialogId,
      params.tenantId,
      { phone: null, email: null, name: null },
    );
    const missing = missingLeadFields(mode, accumulated);

    return {
      mode,
      missing,
      hasLead: false,
      instruction: leadGoalInstruction(mode, missing),
    };
  }

  async processMessage(params: {
    tenantId: string;
    sourceId: string;
    dialogId: string;
    content: string;
    sourceConfig: SourceConfig;
  }): Promise<{
    created: boolean;
    leadId?: string;
    duplicateLeadId?: string;
  }> {
    const config = params.sourceConfig.ai?.leadExtraction;
    if (config?.enabled === false) {
      return { created: false };
    }

    const mode = resolveLeadProfileMode(config);

    const existing = await this.prisma.lead.findUnique({
      where: { dialogId: params.dialogId },
    });
    if (existing) {
      return { created: false, leadId: existing.id };
    }

    const entities = this.ner.extract(params.content);
    const accumulated = await this.accumulateFromHistory(
      params.dialogId,
      params.tenantId,
      entities,
    );

    const missing = missingLeadFields(mode, accumulated);
    if (missing.length > 0) {
      return { created: false };
    }

    if (accumulated.phone) {
      const since = new Date();
      since.setDate(since.getDate() - this.dedupeDays);
      const duplicate = await this.prisma.lead.findFirst({
        where: {
          tenantId: params.tenantId,
          phone: accumulated.phone,
          archived: false,
          createdAt: { gte: since },
          NOT: { dialogId: params.dialogId },
        },
      });
      if (duplicate) {
        return { created: false, duplicateLeadId: duplicate.id };
      }
    }

    const defaultStatus = await this.pipelines.getDefaultStatus(
      params.tenantId,
    );

    const dialog = await this.prisma.dialog.findUnique({
      where: { id: params.dialogId },
    });
    const attribution = dialog ? leadAttributionFromDialog(dialog) : {};

    try {
      const lead = await this.prisma.lead.create({
        data: {
          tenantId: params.tenantId,
          dialogId: params.dialogId,
          sourceId: params.sourceId,
          name: accumulated.name,
          phone: accumulated.phone,
          email: accumulated.email,
          pipelineId: defaultStatus?.pipelineId,
          statusId: defaultStatus?.id,
          ...attribution,
        },
      });

      if (defaultStatus) {
        await this.prisma.leadStatusHistory.create({
          data: {
            tenantId: params.tenantId,
            leadId: lead.id,
            toStatusId: defaultStatus.id,
          },
        });
      }

      this.logger.log(`Lead created for dialog ${params.dialogId}`);
      void this.conversionTracking.trackLeadCreated(params.tenantId, lead.id);
      void this.leadDelivery.enqueueForLead(params.tenantId, lead.id);

      const body =
        [accumulated.name, accumulated.phone].filter(Boolean).join(' · ') ||
        'Новый контакт';
      void this.notifications
        .create({
          tenantId: params.tenantId,
          type: 'lead.created',
          title: 'Новый лид',
          body,
          metadata: { leadId: lead.id, dialogId: params.dialogId },
        })
        .then((notification) => {
          this.crmGateway.emitNotification(params.tenantId, notification);
        })
        .catch((err) => {
          this.logger.warn(`Lead notification failed: ${String(err)}`);
        });

      this.crmGateway.emitNewLead(params.tenantId, {
        leadId: lead.id,
        name: lead.name,
        phone: lead.phone,
      });

      void this.outgoingWebhook.deliver(params.tenantId, 'lead.created', {
        leadId: lead.id,
        dialogId: params.dialogId,
        sourceId: params.sourceId,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
      });

      void this.promptExperiments.markConverted(params.dialogId);
      void this.push.notifyTenant(params.tenantId, {
        title: 'Новый лид',
        body,
        url: '/crm',
      });

      return { created: true, leadId: lead.id };
    } catch (error) {
      this.logger.warn(`Lead creation skipped: ${String(error)}`);
      return { created: false };
    }
  }

  private async accumulateFromHistory(
    dialogId: string,
    tenantId: string,
    current: { phone: string | null; email: string | null; name: string | null },
  ) {
    const messages = await this.prisma.message.findMany({
      where: { dialogId, tenantId, role: 'user' },
      orderBy: { createdAt: 'asc' },
    });

    const merged = { ...current };
    for (const msg of messages) {
      const extracted = this.ner.extract(msg.content);
      if (!merged.phone && extracted.phone) merged.phone = extracted.phone;
      if (!merged.email && extracted.email) merged.email = extracted.email;
      if (!merged.name && extracted.name) merged.name = extracted.name;
      if (merged.name && extracted.name && extracted.name.length > merged.name.length) {
        merged.name = extracted.name;
      }
    }

    return merged;
  }
}
