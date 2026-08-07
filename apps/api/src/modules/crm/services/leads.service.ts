import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { PipelinesService } from './pipelines.service';
import { LeadDedupService } from './lead-dedup.service';
import { EmailService } from '../../../common/email/email.service';
import { CrmGateway } from '../crm.gateway';
import { ConversionTrackingService } from '../../integrations/services/conversion-tracking.service';
import { CrmStatusSyncQueueService } from '../../integrations/services/crm-status-sync-queue.service';
import { toAttributionDto } from '../../integrations/attribution.util';

@Injectable()
export class LeadsService {
  private readonly dedupeDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pipelines: PipelinesService,
    private readonly dedup: LeadDedupService,
    private readonly email: EmailService,
    private readonly crmGateway: CrmGateway,
    private readonly conversionTracking: ConversionTrackingService,
    private readonly crmStatusSyncQueue: CrmStatusSyncQueueService,
    config: ConfigService,
  ) {
    this.dedupeDays = config.get<number>('LEAD_DEDUPE_DAYS', 30);
  }

  async findAll(
    tenantId: string,
    filters: {
      statusId?: string;
      sourceId?: string;
      assignedUserId?: string;
      tag?: string;
      from?: string;
      to?: string;
      includeArchived?: boolean;
    },
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (!filters.includeArchived) where.archived = false;
    if (filters.statusId) where.statusId = filters.statusId;
    if (filters.sourceId) where.sourceId = filters.sourceId;
    if (filters.assignedUserId) where.assignedUserId = filters.assignedUserId;
    if (filters.tag) where.tags = { has: filters.tag };
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    const leads = await this.prisma.lead.findMany({
      where,
      include: {
        status: true,
        assignedUser: { select: { id: true, email: true } },
        source: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    return leads.map((l) => this.toDto(l));
  }

  async findOne(tenantId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, tenantId },
      include: {
        status: true,
        assignedUser: { select: { id: true, email: true } },
        source: { select: { id: true, name: true } },
      },
    });
    if (!lead) throw new NotFoundException('Лид не найден');
    return this.toDto(lead);
  }

  async getStatusHistory(tenantId: string, leadId: string) {
    await this.findOne(tenantId, leadId);
    const history = await this.prisma.leadStatusHistory.findMany({
      where: { leadId, tenantId },
      include: { fromStatus: true, toStatus: true },
      orderBy: { createdAt: 'desc' },
    });
    return history.map((h) => ({
      id: h.id,
      leadId: h.leadId,
      fromStatusId: h.fromStatusId,
      toStatusId: h.toStatusId,
      changedById: h.changedById,
      createdAt: h.createdAt.toISOString(),
      fromStatus: h.fromStatus ? this.statusToDto(h.fromStatus) : null,
      toStatus: this.statusToDto(h.toStatus),
    }));
  }

  async updateStatus(
    tenantId: string,
    leadId: string,
    statusId: string,
    changedById?: string,
  ) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId, archived: false },
    });
    if (!lead) throw new NotFoundException('Лид не найден');

    const status = await this.prisma.pipelineStatus.findFirst({
      where: { id: statusId, pipeline: { tenantId } },
    });
    if (!status) throw new NotFoundException('Статус не найден');
    if (lead.pipelineId && lead.pipelineId !== status.pipelineId) {
      throw new BadRequestException('Статус не принадлежит воронке лида');
    }

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        statusId,
        pipelineId: status.pipelineId,
      },
      include: {
        status: true,
        assignedUser: { select: { id: true, email: true } },
        source: { select: { id: true, name: true } },
      },
    });

    await this.prisma.leadStatusHistory.create({
      data: {
        tenantId,
        leadId,
        fromStatusId: lead.statusId,
        toStatusId: statusId,
        changedById,
      },
    });

    if (this.conversionTracking.isDealWonStatus(status.name)) {
      void this.conversionTracking.trackDealWon(tenantId, leadId);
    }

    void this.crmStatusSyncQueue.enqueueStatusPush(tenantId, leadId, statusId);

    return this.toDto(updated);
  }

  async assign(
    tenantId: string,
    leadId: string,
    assignedUserId: string | null,
    actorId?: string,
  ) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenantId, archived: false },
    });
    if (!lead) throw new NotFoundException('Лид не найден');

    if (assignedUserId) {
      const user = await this.prisma.user.findFirst({
        where: { id: assignedUserId, tenantId },
      });
      if (!user) throw new NotFoundException('Пользователь не найден');
    }

    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: { assignedUserId },
      include: {
        status: true,
        assignedUser: { select: { id: true, email: true } },
        source: { select: { id: true, name: true } },
      },
    });

    if (assignedUserId && updated.assignedUser) {
      await this.email.sendLeadAssignment(
        updated.assignedUser.email,
        updated.name ?? 'Без имени',
      );
      this.crmGateway.emitLeadAssigned(tenantId, assignedUserId, {
        leadId: updated.id,
        name: updated.name,
        phone: updated.phone,
        assignedBy: actorId,
      });
    }

    return this.toDto(updated);
  }

  async updateNotes(tenantId: string, leadId: string, notes: string) {
    await this.findOne(tenantId, leadId);
    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: { notes },
      include: {
        status: true,
        assignedUser: { select: { id: true, email: true } },
        source: { select: { id: true, name: true } },
      },
    });
    return this.toDto(updated);
  }

  async findDuplicates(
    tenantId: string,
    opts: { phone?: string; visitorId?: string },
  ) {
    if (opts.visitorId?.trim()) {
      const lead = await this.dedup.findByVisitor(
        tenantId,
        opts.visitorId,
        '',
      );
      if (!lead) return [];
      return [
        {
          leadId: lead.id,
          name: lead.name,
          phone: lead.phone,
          createdAt: lead.createdAt.toISOString(),
          matchBy: 'visitor' as const,
        },
      ];
    }

    if (!opts.phone?.trim()) return [];

    const since = new Date();
    since.setDate(since.getDate() - this.dedupeDays);

    const duplicates = await this.prisma.lead.findMany({
      where: {
        tenantId,
        phone: opts.phone,
        archived: false,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
    });

    return duplicates.map((d) => ({
      leadId: d.id,
      name: d.name,
      phone: d.phone,
      createdAt: d.createdAt.toISOString(),
      matchBy: 'phone' as const,
    }));
  }

  async merge(tenantId: string, sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      throw new BadRequestException('Нельзя объединить лид с самим собой');
    }

    const [source, target] = await Promise.all([
      this.prisma.lead.findFirst({ where: { id: sourceId, tenantId } }),
      this.prisma.lead.findFirst({ where: { id: targetId, tenantId } }),
    ]);

    if (!source || !target) throw new NotFoundException('Лид не найден');
    if (source.archived) throw new BadRequestException('Лид уже архивирован');

    await this.prisma.$transaction(async (tx) => {
      await tx.message.updateMany({
        where: { dialogId: source.dialogId, tenantId },
        data: { dialogId: target.dialogId },
      });

      await tx.lead.update({
        where: { id: sourceId },
        data: {
          archived: true,
          mergedIntoId: targetId,
          notes: [
            source.notes,
            `Объединён с лидом ${targetId} (${new Date().toISOString()})`,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      });

      if (!target.phone && source.phone) {
        await tx.lead.update({
          where: { id: targetId },
          data: {
            phone: source.phone,
            name: target.name ?? source.name,
            email: target.email ?? source.email,
          },
        });
      }
    });

    return this.findOne(tenantId, targetId);
  }

  async archiveMany(tenantId: string, leadIds: string[]) {
    if (!leadIds.length) return { archived: 0 };
    const result = await this.prisma.lead.updateMany({
      where: {
        tenantId,
        id: { in: leadIds },
        archived: false,
      },
      data: { archived: true },
    });
    return { archived: result.count };
  }

  async listTenantUsers(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId, status: 'active' },
      select: { id: true, email: true, role: true },
      orderBy: { email: 'asc' },
    });
    return users;
  }

  async getDialogMessages(tenantId: string, leadId: string) {
    const lead = await this.findOne(tenantId, leadId);
    const messages = await this.prisma.message.findMany({
      where: { dialogId: lead.dialogId, tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  private toDto(lead: {
    id: string;
    tenantId: string;
    dialogId: string;
    sourceId: string | null;
    pipelineId: string | null;
    statusId: string | null;
    assignedUserId: string | null;
    mergedIntoId: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
    utmJson: unknown;
    referrer: string | null;
    landingPage: string | null;
    yandexClientId: string | null;
    gaClientId: string | null;
    externalId: string | null;
    externalCrmType: string | null;
    syncStatus: string;
    syncError: string | null;
    lastSyncAt: Date | null;
    tags: string[];
    notes: string | null;
    archived: boolean;
    createdAt: Date;
    updatedAt: Date;
    status?: {
      id: string;
      pipelineId: string;
      name: string;
      sortOrder: number;
      color: string;
    } | null;
    assignedUser?: { id: string; email: string } | null;
    source?: { id: string; name: string } | null;
  }) {
    return {
      id: lead.id,
      tenantId: lead.tenantId,
      dialogId: lead.dialogId,
      sourceId: lead.sourceId,
      pipelineId: lead.pipelineId,
      statusId: lead.statusId,
      assignedUserId: lead.assignedUserId,
      mergedIntoId: lead.mergedIntoId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      attribution: toAttributionDto(lead),
      externalId: lead.externalId,
      externalCrmType: lead.externalCrmType,
      syncStatus: lead.syncStatus,
      syncError: lead.syncError,
      lastSyncAt: lead.lastSyncAt?.toISOString() ?? null,
      tags: lead.tags,
      notes: lead.notes,
      archived: lead.archived,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
      status: lead.status ? this.statusToDto(lead.status) : null,
      assignedUser: lead.assignedUser ?? null,
      source: lead.source ?? null,
    };
  }

  private statusToDto(status: {
    id: string;
    pipelineId: string;
    name: string;
    sortOrder: number;
    color: string;
  }) {
    return {
      id: status.id,
      pipelineId: status.pipelineId,
      name: status.name,
      sortOrder: status.sortOrder,
      color: status.color,
    };
  }
}
