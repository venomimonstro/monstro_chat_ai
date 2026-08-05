import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

@Injectable()
export class DialogsService {
  constructor(private readonly prisma: PrismaService) {}

  async listDialogs(
    tenantId: string,
    filters: {
      sourceId?: string;
      status?: 'active' | 'closed';
      hasLead?: boolean;
      q?: string;
      cursor?: string;
      limit?: number;
    },
  ) {
    const take = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const where: Record<string, unknown> = { tenantId };

    if (filters.sourceId) where.sourceId = filters.sourceId;
    if (filters.status) where.status = filters.status;
    if (filters.hasLead === true) where.lead = { isNot: null };
    if (filters.hasLead === false) where.lead = { is: null };

    const q = filters.q?.trim();
    if (q) {
      where.OR = [
        { visitorId: { contains: q, mode: 'insensitive' } },
        {
          lead: {
            is: {
              OR: [
                { phone: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    const dialogs = await this.prisma.dialog.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(filters.cursor
        ? {
            cursor: { id: filters.cursor },
            skip: 1,
          }
        : {}),
      include: {
        source: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true, phone: true } },
        messages: {
          where: { role: { in: ['user', 'assistant'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, role: true, createdAt: true },
        },
        _count: { select: { messages: true } },
      },
    });

    const hasMore = dialogs.length > take;
    const page = hasMore ? dialogs.slice(0, take) : dialogs;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    const visitorCounts = await this.groupVisitorDialogCounts(
      tenantId,
      page.map((d) => d.visitorId),
    );

    return {
      items: page.map((dialog) => {
        const last = dialog.messages[0];
        return {
          id: dialog.id,
          sourceId: dialog.sourceId,
          sourceName: dialog.source?.name ?? null,
          visitorId: dialog.visitorId,
          status: dialog.status,
          startedAt: dialog.startedAt.toISOString(),
          updatedAt: dialog.updatedAt.toISOString(),
          endedAt: dialog.endedAt?.toISOString() ?? null,
          messageCount: dialog._count.messages,
          visitorDialogCount: visitorCounts.get(dialog.visitorId) ?? 1,
          hasLead: Boolean(dialog.lead),
          lead: dialog.lead
            ? {
                id: dialog.lead.id,
                name: dialog.lead.name,
                phone: dialog.lead.phone,
              }
            : null,
          lastMessage: last
            ? {
                role: last.role,
                content: last.content.slice(0, 160),
                createdAt: last.createdAt.toISOString(),
              }
            : null,
        };
      }),
      nextCursor,
    };
  }

  async getDialog(tenantId: string, dialogId: string) {
    const dialog = await this.prisma.dialog.findFirst({
      where: { id: dialogId, tenantId },
      include: {
        source: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true, phone: true, email: true } },
        _count: { select: { messages: true } },
      },
    });
    if (!dialog) throw new NotFoundException('Диалог не найден');

    const priorDialogs = await this.prisma.dialog.count({
      where: {
        tenantId,
        visitorId: dialog.visitorId,
        sourceId: dialog.sourceId,
        createdAt: { lt: dialog.createdAt },
      },
    });

    return {
      id: dialog.id,
      sourceId: dialog.sourceId,
      sourceName: dialog.source?.name ?? null,
      visitorId: dialog.visitorId,
      status: dialog.status,
      summary: dialog.summary,
      startedAt: dialog.startedAt.toISOString(),
      updatedAt: dialog.updatedAt.toISOString(),
      endedAt: dialog.endedAt?.toISOString() ?? null,
      referrer: dialog.referrer,
      landingPage: dialog.landingPage,
      messageCount: dialog._count.messages,
      isReturningVisitor: priorDialogs > 0,
      priorDialogCount: priorDialogs,
      hasLead: Boolean(dialog.lead),
      lead: dialog.lead,
    };
  }

  async getTranscript(tenantId: string, dialogId: string) {
    await this.getDialog(tenantId, dialogId);
    const messages = await this.prisma.message.findMany({
      where: {
        dialogId,
        tenantId,
        role: { in: ['user', 'assistant', 'manager'] },
        NOT: { content: { startsWith: '__DEDUP_LINK__:' } },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        feedback: { select: { rating: true } },
      },
    });

    return messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      provider: m.provider,
      model: m.model,
      feedbackRating: m.feedback?.rating ?? null,
    }));
  }

  async exportTranscriptText(tenantId: string, dialogId: string): Promise<string> {
    const dialog = await this.getDialog(tenantId, dialogId);
    const messages = await this.getTranscript(tenantId, dialogId);
    const header = [
      `Диалог ${dialog.id}`,
      `Источник: ${dialog.sourceName ?? dialog.sourceId}`,
      `Посетитель: ${dialog.visitorId}`,
      `Начало: ${dialog.startedAt}`,
      '',
    ].join('\n');

    const body = messages
      .map((m) => {
        const time = new Date(m.createdAt).toLocaleString('ru-RU');
        const role =
          m.role === 'user'
            ? 'Посетитель'
            : m.role === 'manager'
              ? 'Менеджер'
              : 'Ассистент';
        return `[${time}] ${role}:\n${m.content}`;
      })
      .join('\n\n');

    return `${header}${body}\n`;
  }

  private async groupVisitorDialogCounts(tenantId: string, visitorIds: string[]) {
    const unique = [...new Set(visitorIds.filter(Boolean))];
    const map = new Map<string, number>();
    if (!unique.length) return map;

    const rows = await this.prisma.dialog.groupBy({
      by: ['visitorId'],
      where: { tenantId, visitorId: { in: unique } },
      _count: { _all: true },
    });

    for (const row of rows) {
      map.set(row.visitorId, row._count._all);
    }
    return map;
  }
}
