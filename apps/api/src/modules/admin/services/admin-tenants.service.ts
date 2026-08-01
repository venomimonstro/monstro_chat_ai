import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'crypto';
import type {
  ImpersonateResponseDto,
  PaginatedResponse,
  ResetPasswordResponseDto,
  TenantDetailDto,
  TenantListItemDto,
  TenantListQuery,
} from '@ai-consultant/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedUser } from '../../../common/interfaces/jwt-payload.interface';
import { AccessTokenPayload } from '../../../common/interfaces/jwt-payload.interface';
import { AuditLogService } from './audit-log.service';
import { MarginAnalyticsService } from './margin-analytics.service';
import { RedisService } from '../../../redis/redis.service';
import { AuthService } from '../../auth/auth.service';

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AdminTenantsService {
  private readonly impersonationTtlSec: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly marginAnalytics: MarginAnalyticsService,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    this.impersonationTtlSec = this.config.get<number>(
      'IMPERSONATION_TTL_SEC',
      3600,
    );
  }

  async listTenants(
    query: TenantListQuery,
  ): Promise<PaginatedResponse<TenantListItemDto>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.TenantWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search?.trim()) {
      where.name = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          tariff: { select: { name: true } },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const ownerEmails = await Promise.all(
      tenants.map(async (tenant) => {
        if (!tenant.ownerUserId) return null;
        const owner = await this.prisma.user.findUnique({
          where: { id: tenant.ownerUserId },
          select: { email: true },
        });
        return owner?.email ?? null;
      }),
    );

    const items: TenantListItemDto[] = tenants.map((tenant, index) => ({
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      balance: Number(tenant.balance),
      tariffName: tenant.tariff?.name ?? null,
      ownerEmail: ownerEmails[index],
      createdAt: tenant.createdAt.toISOString(),
    }));

    return { items, total, page, limit };
  }

  async getTenantDetail(tenantId: string): Promise<TenantDetailDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { tariff: true },
    });
    if (!tenant) throw new NotFoundException('Тенант не найден');

    const [owner, users, dialogs, leads, sources] = await Promise.all([
      tenant.ownerUserId
        ? this.prisma.user.findUnique({
            where: { id: tenant.ownerUserId },
            select: { id: true, email: true },
          })
        : null,
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.dialog.count({ where: { tenantId } }),
      this.prisma.lead.count({ where: { tenantId, archived: false } }),
      this.prisma.source.count({ where: { tenantId } }),
    ]);

    return {
      id: tenant.id,
      name: tenant.name,
      status: tenant.status,
      balance: Number(tenant.balance),
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      createdAt: tenant.createdAt.toISOString(),
      tariff: tenant.tariff
        ? {
            id: tenant.tariff.id,
            name: tenant.tariff.name,
            price: Number(tenant.tariff.price),
          }
        : null,
      owner: owner ? { id: owner.id, email: owner.email } : null,
      stats: { users, dialogs, leads, sources },
    };
  }

  async blockTenant(
    tenantId: string,
    reason: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ) {
    const tenant = await this.requireTenant(tenantId);
    if (tenant.status === 'suspended') {
      throw new BadRequestException('Тенант уже заблокирован');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'suspended' },
    });

    await this.auditLog.append({
      actorUserId: actor.id,
      actorEmail: actor.email,
      targetTenantId: tenantId,
      action: 'tenant.block',
      reason,
      beforeJson: { status: tenant.status },
      afterJson: { status: updated.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.getTenantDetail(tenantId);
  }

  async blockTenantsBulk(
    tenantIds: string[],
    reason: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ) {
    const uniqueIds = [...new Set(tenantIds)];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: uniqueIds } },
    });
    if (tenants.length === 0) {
      throw new NotFoundException('Тенанты не найдены');
    }

    const toBlock = tenants.filter((t) => t.status !== 'suspended');
    if (toBlock.length === 0) {
      throw new BadRequestException('Все выбранные тенанты уже заблокированы');
    }

    await this.prisma.tenant.updateMany({
      where: { id: { in: toBlock.map((t) => t.id) } },
      data: { status: 'suspended' },
    });

    await this.auditLog.append({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: 'tenant.block',
      reason,
      beforeJson: {
        tenantIds: toBlock.map((t) => t.id),
        statuses: Object.fromEntries(toBlock.map((t) => [t.id, t.status])),
      },
      afterJson: {
        tenantIds: toBlock.map((t) => t.id),
        status: 'suspended',
        count: toBlock.length,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { blocked: toBlock.length, tenantIds: toBlock.map((t) => t.id) };
  }

  async exportTenantsCsv(query: TenantListQuery): Promise<string> {
    const where: Prisma.TenantWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search?.trim()) {
      where.name = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const tenants = await this.prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
      include: { tariff: { select: { name: true } } },
    });

    const ownerEmails = await Promise.all(
      tenants.map(async (tenant) => {
        if (!tenant.ownerUserId) return '';
        const owner = await this.prisma.user.findUnique({
          where: { id: tenant.ownerUserId },
          select: { email: true },
        });
        return owner?.email ?? '';
      }),
    );

    const header = 'id,name,status,balance,tariff,owner_email,created_at';
    const rows = tenants.map((tenant, i) =>
      [
        tenant.id,
        csvEscape(tenant.name),
        tenant.status,
        Number(tenant.balance),
        csvEscape(tenant.tariff?.name ?? ''),
        csvEscape(ownerEmails[i]),
        tenant.createdAt.toISOString(),
      ].join(','),
    );
    return [header, ...rows].join('\n');
  }

  async unblockTenant(
    tenantId: string,
    reason: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ) {
    const tenant = await this.requireTenant(tenantId);
    if (tenant.status !== 'suspended') {
      throw new BadRequestException('Тенант не заблокирован');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'active' },
    });

    await this.auditLog.append({
      actorUserId: actor.id,
      actorEmail: actor.email,
      targetTenantId: tenantId,
      action: 'tenant.unblock',
      reason,
      beforeJson: { status: tenant.status },
      afterJson: { status: updated.status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.getTenantDetail(tenantId);
  }

  async changeTariff(
    tenantId: string,
    tariffId: string,
    reason: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ) {
    const tenant = await this.requireTenant(tenantId);
    const tariff = await this.prisma.tariff.findUnique({ where: { id: tariffId } });
    if (!tariff) throw new NotFoundException('Тариф не найден');

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { tariffId },
    });

    await this.auditLog.append({
      actorUserId: actor.id,
      actorEmail: actor.email,
      targetTenantId: tenantId,
      action: 'tenant.tariff_change',
      reason,
      beforeJson: { tariffId: tenant.tariffId },
      afterJson: { tariffId: updated.tariffId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.getTenantDetail(tenantId);
  }

  async adjustBalance(
    tenantId: string,
    amount: number,
    reason: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException('Причина корректировки обязательна');
    }
    if (!Number.isFinite(amount) || amount === 0) {
      throw new BadRequestException('Сумма должна быть ненулевым числом');
    }

    const tenant = await this.requireTenant(tenantId);
    const beforeBalance = Number(tenant.balance);
    const afterBalance = beforeBalance + amount;

    await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { balance: afterBalance },
      }),
      this.prisma.transaction.create({
        data: {
          tenantId,
          type: 'correction',
          amount,
          currency: 'RUB',
          description: `Корректировка админом: ${reason}`,
        },
      }),
    ]);

    await this.auditLog.append({
      actorUserId: actor.id,
      actorEmail: actor.email,
      targetTenantId: tenantId,
      action: 'tenant.balance_adjustment',
      reason,
      beforeJson: { balance: beforeBalance },
      afterJson: { balance: afterBalance, amount },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.getTenantDetail(tenantId);
  }

  async resetOwnerPassword(
    tenantId: string,
    reason: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<ResetPasswordResponseDto> {
    const tenant = await this.requireTenant(tenantId);
    const owner = tenant.ownerUserId
      ? await this.prisma.user.findUnique({ where: { id: tenant.ownerUserId } })
      : await this.prisma.user.findFirst({
          where: { tenantId, role: 'client' },
          orderBy: { createdAt: 'asc' },
        });

    if (!owner) {
      throw new NotFoundException('Владелец тенанта не найден');
    }

    const temporaryPassword = randomBytes(9).toString('base64url');
    const passwordHash = await argon2.hash(temporaryPassword, {
      type: argon2.argon2id,
    });

    await this.prisma.user.update({
      where: { id: owner.id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });

    await this.authService.revokeAllSessions(owner.id);

    await this.auditLog.append({
      actorUserId: actor.id,
      actorEmail: actor.email,
      targetTenantId: tenantId,
      targetUserId: owner.id,
      action: 'tenant.password_reset',
      reason,
      afterJson: { userEmail: owner.email },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { userEmail: owner.email };
  }

  async impersonate(
    tenantId: string,
    reason: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<ImpersonateResponseDto> {
    const tenant = await this.requireTenant(tenantId);
    const targetUser = tenant.ownerUserId
      ? await this.prisma.user.findUnique({ where: { id: tenant.ownerUserId } })
      : await this.prisma.user.findFirst({
          where: { tenantId, status: 'active' },
          orderBy: { createdAt: 'asc' },
        });

    if (!targetUser || targetUser.status !== 'active') {
      throw new NotFoundException('Активный пользователь тенанта не найден');
    }

    const exchangeCode = randomUUID();
    const payload: AccessTokenPayload = {
      sub: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      tenantId: tenant.id,
      type: 'access',
      twoFaVerified: true,
      impersonatedBy: actor.id,
      impersonationActorEmail: actor.email,
      impersonationReason: reason,
    };

    const accessToken = this.jwtService.sign(
      { ...payload },
      { expiresIn: this.impersonationTtlSec },
    );

    const redis = this.redis.getClient();
    if (redis) {
      await redis.setex(
        `impersonation:${exchangeCode}`,
        this.impersonationTtlSec,
        accessToken,
      );
    }

    await this.auditLog.append({
      actorUserId: actor.id,
      actorEmail: actor.email,
      targetTenantId: tenantId,
      targetUserId: targetUser.id,
      action: 'tenant.impersonate',
      reason,
      afterJson: { targetUserEmail: targetUser.email },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const webClientUrl = this.config.get<string>(
      'WEB_CLIENT_URL',
      'http://localhost:5173',
    );

    return {
      exchangeCode,
      expiresIn: this.impersonationTtlSec,
      webClientUrl,
      tenantId: tenant.id,
      tenantName: tenant.name,
    };
  }

  getTenantMargin(
    tenantId: string,
    from?: Date,
    to?: Date,
  ) {
    return this.marginAnalytics.getTenantMargin(tenantId, from, to);
  }

  async exchangeImpersonationCode(exchangeCode: string): Promise<{ accessToken: string }> {
    const redis = this.redis.getClient();
    if (!redis) {
      throw new NotFoundException('Impersonation exchange unavailable');
    }
    const key = `impersonation:${exchangeCode}`;
    const accessToken = await redis.get(key);
    if (!accessToken) {
      throw new NotFoundException('Invalid or expired impersonation code');
    }
    await redis.del(key);
    return { accessToken };
  }

  private async requireTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Тенант не найден');
    return tenant;
  }
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
