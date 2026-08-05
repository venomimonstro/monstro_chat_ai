import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { SourceConfig } from '@ai-consultant/shared-types';
import { NerService } from './ner.service';
import { LlmNerService } from './llm-ner.service';
import { LeadDedupService } from './lead-dedup.service';
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
  canCreatePartialLead,
  leadGoalInstruction,
  missingLeadFields,
  requiredFieldsForMode,
  resolveLeadProfileMode,
  type LeadField,
} from '../utils/lead-profile.util';
import {
  looksLikeContactPayload,
  shouldAskForContact,
} from '../utils/lead-timing.util';
import { AnalyticsCacheService } from '../../analytics/services/analytics-cache.service';

@Injectable()
export class LeadExtractionService {
  private readonly logger = new Logger(LeadExtractionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ner: NerService,
    private readonly llmNer: LlmNerService,
    private readonly dedup: LeadDedupService,
    private readonly pipelines: PipelinesService,
    private readonly conversionTracking: ConversionTrackingService,
    private readonly leadDelivery: LeadDeliveryQueueService,
    private readonly outgoingWebhook: OutgoingWebhookService,
    private readonly notifications: NotificationsService,
    private readonly crmGateway: CrmGateway,
    private readonly promptExperiments: PromptExperimentService,
    private readonly push: PushService,
    private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  async getLeadState(params: {
    tenantId: string;
    dialogId: string;
    sessionDialogId?: string;
    sourceConfig: SourceConfig;
    lastUserMessage?: string;
  }): Promise<{
    mode: ReturnType<typeof resolveLeadProfileMode>;
    missing: LeadField[];
    hasLead: boolean;
    instruction: string | null;
    askNow: boolean;
  }> {
    const config = params.sourceConfig.ai?.leadExtraction;
    if (config?.enabled === false) {
      return {
        mode: 'phone',
        missing: [],
        hasLead: false,
        instruction: null,
        askNow: false,
      };
    }

    const sessionDialogId = params.sessionDialogId ?? params.dialogId;
    const effective = await this.dedup.resolveEffectiveDialog(
      params.tenantId,
      sessionDialogId,
    );
    const dialogId = effective.dialogId;

    const mode = resolveLeadProfileMode(config);
    let existing = await this.prisma.lead.findUnique({
      where: { dialogId },
    });

    if (!existing && config?.dedupeByVisitor !== false) {
      const dialog = await this.prisma.dialog.findUnique({
        where: { id: sessionDialogId },
      });
      if (dialog?.visitorId) {
        existing =
          (await this.dedup.findByVisitor(
            params.tenantId,
            dialog.visitorId,
            sessionDialogId,
          )) ?? null;
      }
    }

    const accumulated = await this.accumulateFromHistory(
      dialogId,
      params.tenantId,
      { phone: null, email: null, name: null },
    );

    // Enrich from existing partial lead
    if (existing) {
      if (!accumulated.phone && existing.phone) accumulated.phone = existing.phone;
      if (!accumulated.email && existing.email) accumulated.email = existing.email;
      if (!accumulated.name && existing.name) accumulated.name = existing.name;
    }

    const missing = missingLeadFields(mode, accumulated);
    if (!missing.length) {
      return {
        mode,
        missing: [],
        hasLead: Boolean(existing),
        instruction: null,
        askNow: false,
      };
    }

    const [userTurns, askedRecently] = await Promise.all([
      this.countUserTurns(dialogId, params.tenantId),
      this.wasContactAskedRecently(dialogId, params.tenantId),
    ]);

    const decision = shouldAskForContact({
      userTurns,
      askedRecently,
      lastUserMessage: params.lastUserMessage ?? '',
      missingCount: missing.length,
      askAfterTurns: config?.askAfterTurns,
    });

    return {
      mode,
      missing,
      hasLead: Boolean(existing),
      askNow: decision.askNow,
      instruction: leadGoalInstruction(mode, missing, {
        askNow: decision.askNow,
      }),
    };
  }

  async processMessage(params: {
    tenantId: string;
    sourceId: string;
    dialogId: string;
    sessionDialogId?: string;
    content: string;
    sourceConfig: SourceConfig;
  }): Promise<{
    created: boolean;
    updated?: boolean;
    partial?: boolean;
    leadId?: string;
    duplicateLeadId?: string;
    linked?: boolean;
    linkedReason?: 'phone' | 'visitor';
  }> {
    const config = params.sourceConfig.ai?.leadExtraction;
    if (config?.enabled === false) {
      return { created: false };
    }

    const sessionDialogId = params.sessionDialogId ?? params.dialogId;
    const effective = await this.dedup.resolveEffectiveDialog(
      params.tenantId,
      sessionDialogId,
    );
    const dialogId = effective.dialogId;

    const mode = resolveLeadProfileMode(config);
    const allowPartial = config?.allowPartial !== false;
    const needed = requiredFieldsForMode(mode);

    let existing = await this.prisma.lead.findUnique({
      where: { dialogId },
    });

    if (!existing && config?.dedupeByVisitor !== false) {
      const dialog = await this.prisma.dialog.findUnique({
        where: { id: sessionDialogId },
      });
      if (dialog?.visitorId) {
        const visitorLead = await this.dedup.findByVisitor(
          params.tenantId,
          dialog.visitorId,
          sessionDialogId,
        );
        if (visitorLead) {
          await this.dedup.linkDialogToLead({
            tenantId: params.tenantId,
            sourceDialogId: sessionDialogId,
            targetLeadId: visitorLead.id,
            reason: 'visitor',
          });
          return {
            created: false,
            linked: true,
            linkedReason: 'visitor',
            leadId: visitorLead.id,
            duplicateLeadId: visitorLead.id,
          };
        }
      }
    }

    let entities = await this.extractEntities(params.content, needed);

    const accumulated = await this.accumulateFromHistory(
      dialogId,
      params.tenantId,
      entities,
    );

    if (existing) {
      const updated = await this.enrichLead(existing.id, params.tenantId, {
        name: accumulated.name,
        phone: accumulated.phone,
        email: accumulated.email,
      });
      return {
        created: false,
        updated,
        leadId: existing.id,
        partial: missingLeadFields(mode, {
          phone: existing.phone ?? accumulated.phone,
          email: existing.email ?? accumulated.email,
          name: existing.name ?? accumulated.name,
        }).length > 0,
      };
    }

    const missing = missingLeadFields(mode, accumulated);
    const complete = missing.length === 0;
    const partialOk = allowPartial && canCreatePartialLead(accumulated);

    if (!complete && !partialOk) {
      return { created: false };
    }

    if (accumulated.phone && config?.dedupeByPhone !== false) {
      const duplicate = await this.dedup.findByPhone(
        params.tenantId,
        accumulated.phone,
        sessionDialogId,
      );
      if (duplicate) {
        await this.dedup.linkDialogToLead({
          tenantId: params.tenantId,
          sourceDialogId: sessionDialogId,
          targetLeadId: duplicate.id,
          reason: 'phone',
          contact: accumulated,
        });
        await this.enrichLead(duplicate.id, params.tenantId, accumulated);
        return {
          created: false,
          linked: true,
          linkedReason: 'phone',
          leadId: duplicate.id,
          duplicateLeadId: duplicate.id,
        };
      }
    }

    const defaultStatus = await this.pipelines.getDefaultStatus(
      params.tenantId,
    );

    const dialog = await this.prisma.dialog.findUnique({
      where: { id: dialogId },
    });
    const attribution = dialog ? leadAttributionFromDialog(dialog) : {};
    const isPartial = !complete;

    try {
      const lead = await this.prisma.lead.create({
        data: {
          tenantId: params.tenantId,
          dialogId,
          sourceId: params.sourceId,
          name: accumulated.name,
          phone: accumulated.phone,
          email: accumulated.email,
          pipelineId: defaultStatus?.pipelineId,
          statusId: defaultStatus?.id,
          notes: isPartial
            ? 'Частичный лид: дозаполнить поля из диалога'
            : undefined,
          tags: isPartial ? ['partial'] : [],
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

      this.logger.log(
        `Lead ${isPartial ? 'partial ' : ''}created for dialog ${params.dialogId}`,
      );
      void this.analyticsCache.invalidateTenant(params.tenantId);
      void this.conversionTracking.trackLeadCreated(params.tenantId, lead.id);
      void this.leadDelivery.enqueueForLead(params.tenantId, lead.id);

      const body =
        [accumulated.name, accumulated.phone].filter(Boolean).join(' · ') ||
        'Новый контакт';
      void this.notifications
        .create({
          tenantId: params.tenantId,
          type: 'lead.created',
          title: isPartial ? 'Новый лид (частичный)' : 'Новый лид',
          body,
          metadata: {
            leadId: lead.id,
            dialogId: params.dialogId,
            partial: isPartial,
          },
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
        partial: isPartial,
      });

      if (!isPartial) {
        void this.promptExperiments.markConverted(params.dialogId);
      }
      void this.push.notifyTenant(params.tenantId, {
        title: isPartial ? 'Новый лид (частичный)' : 'Новый лид',
        body,
        url: '/crm',
      });

      return { created: true, leadId: lead.id, partial: isPartial };
    } catch (error) {
      this.logger.warn(`Lead creation skipped: ${String(error)}`);
      return { created: false };
    }
  }

  private async extractEntities(
    content: string,
    needed: LeadField[],
  ) {
    const regex = this.ner.extract(content);
    const missingNeeded = needed.some((f) => !regex[f]);
    if (!missingNeeded || !looksLikeContactPayload(content)) {
      return regex;
    }
    return this.llmNer.extractHybrid(content, needed);
  }

  private async enrichLead(
    leadId: string,
    tenantId: string,
    data: { name: string | null; phone: string | null; email: string | null },
  ): Promise<boolean> {
    const current = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });
    if (!current) return false;

    const patch: {
      name?: string;
      phone?: string;
      email?: string;
      notes?: string | null;
      tags?: string[];
    } = {};
    if (!current.name && data.name) patch.name = data.name;
    if (!current.phone && data.phone) patch.phone = data.phone;
    if (!current.email && data.email) patch.email = data.email;

    const nextName = patch.name ?? current.name;
    const nextPhone = patch.phone ?? current.phone;
    const nextEmail = patch.email ?? current.email;
    const stillPartial = !nextPhone; // phone is the bar for "usable"

    if (
      current.tags?.includes('partial') &&
      nextPhone &&
      Object.keys(patch).length > 0
    ) {
      patch.tags = current.tags.filter((t) => t !== 'partial');
      if (current.notes?.startsWith('Частичный лид')) {
        patch.notes = null;
      }
    }

    if (Object.keys(patch).length === 0) return false;

    await this.prisma.lead.update({
      where: { id: leadId },
      data: patch,
    });
    this.logger.log(
      `Lead ${leadId} enriched${stillPartial ? ' (still partial)' : ''}`,
    );
    void this.analyticsCache.invalidateTenant(tenantId);
    return true;
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
      // History: regex only (avoid N LLM calls per turn).
      const extracted = this.ner.extract(msg.content);
      if (!merged.phone && extracted.phone) merged.phone = extracted.phone;
      if (!merged.email && extracted.email) merged.email = extracted.email;
      if (!merged.name && extracted.name) merged.name = extracted.name;
      if (
        merged.name &&
        extracted.name &&
        extracted.name.length > merged.name.length
      ) {
        merged.name = extracted.name;
      }
    }

    return merged;
  }

  private async countUserTurns(
    dialogId: string,
    tenantId: string,
  ): Promise<number> {
    return this.prisma.message.count({
      where: { dialogId, tenantId, role: 'user' },
    });
  }

  private async wasContactAskedRecently(
    dialogId: string,
    tenantId: string,
  ): Promise<boolean> {
    const recent = await this.prisma.message.findMany({
      where: { dialogId, tenantId, role: 'assistant' },
      orderBy: { createdAt: 'desc' },
      take: 2,
      select: { content: true },
    });
    return recent.some((m) => m.content.includes('---contact---'));
  }
}
