import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

@Injectable()
export class BadAnswersService {
  constructor(private readonly prisma: PrismaService) {}

  async listBadAnswers(
    tenantId: string,
    filters: { sourceId?: string; cursor?: string; limit?: number },
  ) {
    const take = Math.min(
      Math.max(filters.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const where = {
      tenantId,
      rating: 'down' as const,
      ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
    };

    const rows = await this.prisma.messageFeedback.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(filters.cursor
        ? { cursor: { id: filters.cursor }, skip: 1 }
        : {}),
      include: {
        message: { select: { content: true, createdAt: true } },
        dialog: { select: { visitorId: true } },
        source: { select: { name: true } },
      },
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    const items = await Promise.all(
      page.map(async (row) => {
        const priorUser = await this.prisma.message.findFirst({
          where: {
            dialogId: row.dialogId,
            tenantId,
            role: 'user',
            createdAt: { lt: row.message.createdAt },
          },
          orderBy: { createdAt: 'desc' },
          select: { content: true },
        });

        return {
          id: row.id,
          messageId: row.messageId,
          dialogId: row.dialogId,
          sourceId: row.sourceId,
          sourceName: row.source?.name ?? null,
          visitorId: row.dialog.visitorId,
          userQuestion: priorUser?.content ?? null,
          assistantAnswer: row.message.content,
          createdAt: row.createdAt.toISOString(),
        };
      }),
    );

    return { items, nextCursor };
  }

  async getStats(tenantId: string, sourceId?: string) {
    const where = {
      tenantId,
      ...(sourceId ? { sourceId } : {}),
    };

    const [up, down] = await Promise.all([
      this.prisma.messageFeedback.count({
        where: { ...where, rating: 'up' },
      }),
      this.prisma.messageFeedback.count({
        where: { ...where, rating: 'down' },
      }),
    ]);

    const total = up + down;
    return {
      up,
      down,
      total,
      satisfactionRate: total > 0 ? up / total : null,
    };
  }
}
