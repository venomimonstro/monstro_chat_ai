import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_SOURCE_CONFIG,
  closerDelayMinutes,
  resolveCloserConfig,
  type SourceConfig,
} from '@ai-consultant/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';
import { LeadExtractionService } from '../services/lead-extraction.service';
import {
  CLOSER_STATE_AWAITING,
  CLOSER_STATE_WON,
} from './constants';

@Injectable()
export class FollowUpSchedulerService {
  private readonly logger = new Logger(FollowUpSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadExtraction: LeadExtractionService,
  ) {}

  async onUserMessage(dialogId: string, tenantId: string) {
    await this.prisma.dialog.updateMany({
      where: { id: dialogId, tenantId, status: 'active' },
      data: {
        followUpCount: 0,
        nextFollowUpAt: null,
        lastUserMessageAt: new Date(),
        closerState: null,
      },
    });
  }

  async onAssistantMessage(params: {
    dialogId: string;
    tenantId: string;
    sourceId: string;
    sourceConfig: SourceConfig;
  }) {
    const closer = resolveCloserConfig(params.sourceConfig.ai?.closer);
    if (!closer.enabled) return;

    const leadState = await this.leadExtraction.getLeadState({
      tenantId: params.tenantId,
      dialogId: params.dialogId,
      sourceConfig: params.sourceConfig,
    });

    if (closer.onlyIncompleteLeads && leadState.missing.length === 0 && leadState.hasLead) {
      await this.prisma.dialog.update({
        where: { id: params.dialogId },
        data: {
          nextFollowUpAt: null,
          closerState: CLOSER_STATE_WON,
        },
      });
      return;
    }

    const delayMinutes = closerDelayMinutes(closer, 0);
    const nextFollowUpAt = new Date(Date.now() + delayMinutes * 60_000);

    await this.prisma.dialog.update({
      where: { id: params.dialogId },
      data: {
        nextFollowUpAt,
        closerState: CLOSER_STATE_AWAITING,
      },
    });

    this.logger.debug(
      `Scheduled follow-up for dialog ${params.dialogId} in ${delayMinutes}m`,
    );
  }

  async scheduleNextAttempt(params: {
    dialogId: string;
    followUpCount: number;
    sourceConfig?: SourceConfig | null;
  }) {
    const config =
      params.sourceConfig ??
      (await this.loadSourceConfig(params.dialogId)) ??
      DEFAULT_SOURCE_CONFIG;
    const closer = resolveCloserConfig(config.ai?.closer);

    if (params.followUpCount >= closer.maxAttempts) {
      await this.prisma.dialog.update({
        where: { id: params.dialogId },
        data: { nextFollowUpAt: null },
      });
      return;
    }

    const delayMinutes = closerDelayMinutes(closer, params.followUpCount);
    await this.prisma.dialog.update({
      where: { id: params.dialogId },
      data: {
        nextFollowUpAt: new Date(Date.now() + delayMinutes * 60_000),
        closerState: CLOSER_STATE_AWAITING,
      },
    });
  }

  private async loadSourceConfig(dialogId: string): Promise<SourceConfig | null> {
    const dialog = await this.prisma.dialog.findUnique({
      where: { id: dialogId },
      include: { source: true },
    });
    if (!dialog?.source) return null;
    return (dialog.source.configJson as unknown as SourceConfig) ?? DEFAULT_SOURCE_CONFIG;
  }
}
