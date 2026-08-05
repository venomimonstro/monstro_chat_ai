import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { CrmGateway } from '../crm.gateway';
import { AnalyticsCacheService } from '../../analytics/services/analytics-cache.service';

export type LeadDedupReason = 'phone' | 'visitor';

export interface LeadLinkResult {
  linked: boolean;
  leadId: string;
  targetDialogId: string;
  reason: LeadDedupReason;
}

@Injectable()
export class LeadDedupService {
  private readonly logger = new Logger(LeadDedupService.name);
  private readonly dedupeDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crmGateway: CrmGateway,
    private readonly analyticsCache: AnalyticsCacheService,
    config: ConfigService,
  ) {
    this.dedupeDays = config.get<number>('LEAD_DEDUPE_DAYS', 30);
  }

  dedupeSince(): Date {
    const since = new Date();
    since.setDate(since.getDate() - this.dedupeDays);
    return since;
  }

  async findByPhone(
    tenantId: string,
    phone: string,
    excludeDialogId: string,
  ) {
    if (!phone?.trim()) return null;
    return this.prisma.lead.findFirst({
      where: {
        tenantId,
        phone,
        archived: false,
        createdAt: { gte: this.dedupeSince() },
        NOT: { dialogId: excludeDialogId },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByVisitor(
    tenantId: string,
    visitorId: string,
    excludeDialogId: string,
  ) {
    if (!visitorId?.trim()) return null;
    const prior = await this.prisma.dialog.findFirst({
      where: {
        tenantId,
        visitorId,
        id: { not: excludeDialogId },
        createdAt: { gte: this.dedupeSince() },
        lead: { is: { archived: false } },
      },
      include: { lead: true },
      orderBy: { createdAt: 'desc' },
    });
    return prior?.lead ?? null;
  }

  /**
   * Attach a new dialog to an existing lead: move messages, enrich fields, log note.
   */
  async linkDialogToLead(params: {
    tenantId: string;
    sourceDialogId: string;
    targetLeadId: string;
    reason: LeadDedupReason;
    contact?: {
      name?: string | null;
      phone?: string | null;
      email?: string | null;
    };
  }): Promise<LeadLinkResult> {
    const target = await this.prisma.lead.findFirst({
      where: { id: params.targetLeadId, tenantId: params.tenantId, archived: false },
    });
    if (!target) throw new NotFoundException('Лид не найден');

    if (target.dialogId === params.sourceDialogId) {
      return {
        linked: true,
        leadId: target.id,
        targetDialogId: target.dialogId,
        reason: params.reason,
      };
    }

    const sourceDialog = await this.prisma.dialog.findFirst({
      where: { id: params.sourceDialogId, tenantId: params.tenantId },
    });
    if (!sourceDialog) throw new NotFoundException('Диалог не найден');

    const movedCount = await this.prisma.$transaction(async (tx) => {
      const result = await tx.message.updateMany({
        where: { dialogId: params.sourceDialogId, tenantId: params.tenantId },
        data: { dialogId: target.dialogId },
      });

      const noteLine =
        params.reason === 'phone'
          ? `Повторное обращение (телефон): диалог ${params.sourceDialogId} объединён ${new Date().toISOString()}`
          : `Повторный визит (visitor): диалог ${params.sourceDialogId} объединён ${new Date().toISOString()}`;

      const tags = new Set(target.tags ?? []);
      tags.add('returning');
      if (params.reason === 'phone') tags.add('dedup_phone');
      if (params.reason === 'visitor') tags.add('dedup_visitor');

      await tx.lead.update({
        where: { id: target.id },
        data: {
          name: target.name ?? params.contact?.name ?? undefined,
          phone: target.phone ?? params.contact?.phone ?? undefined,
          email: target.email ?? params.contact?.email ?? undefined,
          notes: [target.notes, noteLine].filter(Boolean).join('\n'),
          tags: [...tags],
          updatedAt: new Date(),
        },
      });

      await tx.dialog.update({
        where: { id: params.sourceDialogId },
        data: { status: 'closed', endedAt: new Date() },
      });

      await tx.message.create({
        data: {
          dialogId: params.sourceDialogId,
          tenantId: params.tenantId,
          role: 'system',
          content: `__DEDUP_LINK__:${target.dialogId}:${target.id}`,
        },
      });

      return result.count;
    });

    this.logger.log(
      `Linked dialog ${params.sourceDialogId} → lead ${target.id} (${params.reason}, ${movedCount} msgs)`,
    );

    void this.analyticsCache.invalidateTenant(params.tenantId);
    this.crmGateway.emitNewLead(params.tenantId, {
      leadId: target.id,
      name: target.name,
      phone: target.phone,
    });

    return {
      linked: true,
      leadId: target.id,
      targetDialogId: target.dialogId,
      reason: params.reason,
    };
  }

  /** If dialog was merged into another, route new messages there. */
  async resolveEffectiveDialog(
    tenantId: string,
    dialogId: string,
  ): Promise<{ dialogId: string; leadId?: string }> {
    const marker = await this.prisma.message.findFirst({
      where: {
        dialogId,
        tenantId,
        role: 'system',
        content: { startsWith: '__DEDUP_LINK__:' },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!marker) return { dialogId };

    const parts = marker.content.split(':');
    const targetDialogId = parts[1];
    const targetLeadId = parts[2];
    if (!targetDialogId) return { dialogId };

    return { dialogId: targetDialogId, leadId: targetLeadId };
  }
}
