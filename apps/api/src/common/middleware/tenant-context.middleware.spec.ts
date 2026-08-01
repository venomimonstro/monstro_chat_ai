import { ForbiddenException } from '@nestjs/common';
import { TenantContextMiddleware } from './tenant-context.middleware';
import { PrismaService } from '../../prisma/prisma.service';

describe('TenantContextMiddleware', () => {
  let middleware: TenantContextMiddleware;
  const mockPrisma = {
    setTenantContext: jest.fn(),
    resetTenantContext: jest.fn(),
  };

  beforeEach(() => {
    middleware = new TenantContextMiddleware(
      mockPrisma as unknown as PrismaService,
    );
    jest.clearAllMocks();
  });

  it('should reject request with mismatched tenant_id in body', async () => {
    const req = {
      authUser: { tenantId: 'tenant-a', id: 'u1', email: 'a@t.com', role: 'client', twoFaVerified: true },
      body: { tenantId: 'tenant-b', name: 'Hack' },
      params: {},
    } as unknown as import('express').Request;

    const next = jest.fn();

    await expect(
      middleware.use(req, {} as import('express').Response, next),
    ).rejects.toThrow(ForbiddenException);

    expect(next).not.toHaveBeenCalled();
  });

  it('should set tenant context for authenticated user', async () => {
    const req = {
      authUser: { tenantId: 'tenant-a', id: 'u1', email: 'a@t.com', role: 'client', twoFaVerified: true },
      body: {},
      params: {},
    } as unknown as import('express').Request;

    const next = jest.fn();
    await middleware.use(req, {} as import('express').Response, next);

    expect(mockPrisma.setTenantContext).toHaveBeenCalledWith('tenant-a');
    expect(next).toHaveBeenCalled();
  });
});
