import { Injectable } from '@nestjs/common';
import {
  DEFAULT_SOURCE_CONFIG,
  resolveCloserConfig,
  type SourceConfig,
} from '@ai-consultant/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';
import { LeadExtractionService } from '../services/lead-extraction.service';
import { CLOSER_STATE_WON } from './constants';

@Injectable()
export class FollowUpEligibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leadExtraction: LeadExtractionService,
  ) {}

  async isEligible(dialogId: string): Promise<{
    eligible: boolean;
    dialog?: {
      id: string;
      tenantId: string;
      sourceId: string;
      visitorId: string;
      followUpCount: number;
    };
    sourceConfig?: SourceConfig;
    reason?: string;
  }> {
    const dialog = await this.prisma.dialog.findUnique({
      where: { id: dialogId },
      include: { source: true },
    });

    if (!dialog || dialog.status !== 'active') {
      return { eligible: false, reason: 'inactive_dialog' };
    }

    if (!dialog.nextFollowUpAt || dialog.nextFollowUpAt > new Date()) {
      return { eligible: false, reason: 'not_due' };
    }

    const sourceConfig =
      (dialog.source.configJson as unknown as SourceConfig) ?? DEFAULT_SOURCE_CONFIG;
    const closer = resolveCloserConfig(sourceConfig.ai?.closer);

    if (!closer.enabled) {
      return { eligible: false, reason: 'closer_disabled' };
    }

    if (dialog.followUpCount >= closer.maxAttempts) {
      return { eligible: false, reason: 'max_attempts' };
    }

    if (dialog.closerState === CLOSER_STATE_WON) {
      return { eligible: false, reason: 'already_won' };
    }

    const lastMessage = await this.prisma.message.findFirst({
      where: { dialogId: dialog.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastMessage || lastMessage.role !== 'assistant') {
      return { eligible: false, reason: 'user_replied' };
    }

    const leadState = await this.leadExtraction.getLeadState({
      tenantId: dialog.tenantId,
      dialogId: dialog.id,
      sourceConfig,
    });

    if (closer.onlyIncompleteLeads && leadState.missing.length === 0 && leadState.hasLead) {
      await this.prisma.dialog.update({
        where: { id: dialog.id },
        data: { closerState: CLOSER_STATE_WON, nextFollowUpAt: null },
      });
      return { eligible: false, reason: 'lead_complete' };
    }

    return {
      eligible: true,
      dialog: {
        id: dialog.id,
        tenantId: dialog.tenantId,
        sourceId: dialog.sourceId,
        visitorId: dialog.visitorId,
        followUpCount: dialog.followUpCount,
      },
      sourceConfig,
    };
  }

  async findDueDialogs(limit = 50): Promise<string[]> {
    const now = new Date();
    const rows = await this.prisma.dialog.findMany({
      where: {
        status: 'active',
        nextFollowUpAt: { lte: now },
        followUpCount: { lt: 10 },
      },
      select: { id: true },
      orderBy: { nextFollowUpAt: 'asc' },
      take: limit,
    });
    return rows.map((r) => r.id);
  }
}
