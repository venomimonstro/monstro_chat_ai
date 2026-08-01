import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import type { AuditLogDto, AuditLogListQuery, PaginatedResponse } from '@ai-consultant/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';

export interface AuditLogInput {
  actorUserId: string;
  actorEmail: string;
  targetTenantId?: string | null;
  targetUserId?: string | null;
  action: string;
  reason?: string | null;
  beforeJson?: Record<string, unknown> | null;
  afterJson?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditLogService {
  private appendChain: Promise<unknown> = Promise.resolve();

  constructor(private readonly prisma: PrismaService) {}

  async append(input: AuditLogInput): Promise<AuditLogDto> {
    const task = this.appendChain.then(() => this.appendInternal(input));
    this.appendChain = task.catch(() => undefined);
    return task;
  }

  private async appendInternal(input: AuditLogInput): Promise<AuditLogDto> {
    const last = await this.prisma.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { recordHash: true },
    });
    const prevHash = last?.recordHash ?? null;

    const payload = {
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      targetTenantId: input.targetTenantId ?? null,
      targetUserId: input.targetUserId ?? null,
      action: input.action,
      reason: input.reason ?? null,
      beforeJson: input.beforeJson ?? null,
      afterJson: input.afterJson ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      prevHash,
      createdAt: new Date().toISOString(),
    };

    const recordHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    const row = await this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        actorEmail: input.actorEmail,
        targetTenantId: input.targetTenantId ?? null,
        targetUserId: input.targetUserId ?? null,
        action: input.action,
        reason: input.reason ?? null,
        beforeJson: (input.beforeJson ?? undefined) as Prisma.InputJsonValue | undefined,
        afterJson: (input.afterJson ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        prevHash,
        recordHash,
      },
    });

    return this.toDto(row);
  }

  async list(
    query: AuditLogListQuery,
  ): Promise<PaginatedResponse<AuditLogDto>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (query.action) where.action = query.action;
    if (query.targetTenantId) where.targetTenantId = query.targetTenantId;
    if (query.actorUserId) where.actorUserId = query.actorUserId;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { actorEmail: { contains: q, mode: 'insensitive' } },
        { reason: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toDto(row)),
      total,
      page,
      limit,
    };
  }

  private toDto(row: {
    id: string;
    actorUserId: string;
    actorEmail: string;
    targetTenantId: string | null;
    targetUserId: string | null;
    action: string;
    reason: string | null;
    beforeJson: unknown;
    afterJson: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    prevHash: string | null;
    recordHash: string;
    createdAt: Date;
  }): AuditLogDto {
    return {
      id: row.id,
      actorUserId: row.actorUserId,
      actorEmail: row.actorEmail,
      targetTenantId: row.targetTenantId,
      targetUserId: row.targetUserId,
      action: row.action,
      reason: row.reason,
      beforeJson: (row.beforeJson as Record<string, unknown> | null) ?? null,
      afterJson: (row.afterJson as Record<string, unknown> | null) ?? null,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      prevHash: row.prevHash,
      recordHash: row.recordHash,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
