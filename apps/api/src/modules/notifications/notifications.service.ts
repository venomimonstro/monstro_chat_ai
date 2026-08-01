import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { NotificationDto, NotificationsListDto } from '@ai-consultant/shared-types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(
    tenantId: string,
    userId: string,
    limit = 30,
  ): Promise<NotificationsListDto> {
    const where: Prisma.InAppNotificationWhereInput = {
      tenantId,
      OR: [{ userId: null }, { userId }],
    };

    const [rows, unreadCount] = await Promise.all([
      this.prisma.inAppNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 100),
      }),
      this.prisma.inAppNotification.count({
        where: { ...where, readAt: null },
      }),
    ]);

    return {
      items: rows.map((row) => this.toDto(row)),
      unreadCount,
    };
  }

  async create(params: {
    tenantId: string;
    userId?: string | null;
    type: string;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }): Promise<NotificationDto> {
    const row = await this.prisma.inAppNotification.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId ?? null,
        type: params.type,
        title: params.title,
        body: params.body,
        metadataJson: (params.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    return this.toDto(row);
  }

  async markRead(id: string, tenantId: string, userId: string) {
    await this.prisma.inAppNotification.updateMany({
      where: {
        id,
        tenantId,
        OR: [{ userId: null }, { userId }],
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  async markAllRead(tenantId: string, userId: string) {
    await this.prisma.inAppNotification.updateMany({
      where: {
        tenantId,
        OR: [{ userId: null }, { userId }],
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { success: true };
  }

  private toDto(row: {
    id: string;
    tenantId: string;
    userId: string | null;
    type: string;
    title: string;
    body: string;
    metadataJson: unknown;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationDto {
    return {
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      type: row.type,
      title: row.title,
      body: row.body,
      metadata: (row.metadataJson as Record<string, unknown>) ?? {},
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
