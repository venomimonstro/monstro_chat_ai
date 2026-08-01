import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  const mockPrisma = {
    auditLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  let service: AuditLogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditLogService(mockPrisma as never);
    mockPrisma.auditLog.findFirst.mockResolvedValue(null);
    mockPrisma.auditLog.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 'log-1',
        ...data,
        createdAt: new Date(),
      }),
    );
  });

  it('creates hash-chained audit record', async () => {
    const result = await service.append({
      actorUserId: 'admin-1',
      actorEmail: 'admin@test.ru',
      action: 'tenant.block',
      reason: 'fraud',
      targetTenantId: 't1',
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prevHash: null,
          recordHash: expect.any(String),
        }),
      }),
    );
    expect(result.recordHash).toBeTruthy();
  });
});
