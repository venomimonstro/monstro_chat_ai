import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AdminTenantsService } from './admin-tenants.service';
import { AuditLogService } from './audit-log.service';
import { MarginAnalyticsService } from './margin-analytics.service';

describe('AdminTenantsService', () => {
  const mockPrisma = {
    tenant: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    tariff: { findUnique: jest.fn() },
    dialog: { count: jest.fn() },
    lead: { count: jest.fn() },
    source: { count: jest.fn() },
    transaction: { create: jest.fn() },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };

  const mockAudit = { append: jest.fn().mockResolvedValue({}) };
  const mockMargin = {} as MarginAnalyticsService;
  const mockJwt = { sign: jest.fn().mockReturnValue('token') } as unknown as JwtService;
  const mockRedis = { getClient: jest.fn().mockReturnValue(null) };
  const mockAuthService = { revokeAllSessions: jest.fn() };
  const mockConfig = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'IMPERSONATION_TTL_SEC') return 3600;
      if (key === 'WEB_CLIENT_URL') return 'http://client.test';
      return fallback;
    }),
  } as unknown as ConfigService;

  const actor = {
    id: 'admin-1',
    email: 'admin@test.ru',
    role: 'owner' as const,
    tenantId: null,
    twoFaVerified: true,
  };

  let service: AdminTenantsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminTenantsService(
      mockPrisma as never,
      mockAudit as unknown as AuditLogService,
      mockMargin,
      mockJwt,
      mockRedis as never,
      mockAuthService as never,
      mockConfig,
    );
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 't1',
      name: 'Test',
      status: 'active',
      balance: 100,
      tariffId: null,
      ownerUserId: 'u1',
    });
  });

  it('rejects balance adjustment without meaningful reason via empty check', async () => {
    await expect(
      service.adjustBalance('t1', 50, '  ', actor, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('records balance adjustment with reason', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 't1',
      name: 'Test',
      status: 'active',
      balance: 150,
      tariffId: null,
      ownerUserId: 'u1',
      trialEndsAt: null,
      createdAt: new Date(),
      tariff: null,
    });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'owner@test.ru' });
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.dialog.count.mockResolvedValue(0);
    mockPrisma.lead.count.mockResolvedValue(0);
    mockPrisma.source.count.mockResolvedValue(0);

    await service.adjustBalance('t1', 50, 'Компенсация', actor, {});

    expect(mockPrisma.transaction.create).toHaveBeenCalled();
    expect(mockAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tenant.balance_adjustment',
        reason: 'Компенсация',
      }),
    );
  });

  it('blockTenantsBulk suspends tenants and writes audit log', async () => {
    mockPrisma.tenant.findMany.mockResolvedValue([
      { id: 't1', status: 'active' },
      { id: 't2', status: 'active' },
    ]);
    mockPrisma.tenant.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.blockTenantsBulk(
      ['t1', 't2'],
      'Массовая блокировка',
      actor,
      {},
    );

    expect(mockPrisma.tenant.updateMany).toHaveBeenCalled();
    expect(mockAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tenant.block',
        reason: 'Массовая блокировка',
      }),
    );
    expect(result.blocked).toBe(2);
  });
});
