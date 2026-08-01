import { ConfigService } from '@nestjs/config';
import { IntegrationType, WebhookDirection, WebhookLogStatus } from '@prisma/client';
import { CrmStatusSyncService } from './crm-status-sync.service';
import { CredentialCryptoService } from './credential-crypto.service';
import { CrmStatusMappingService } from './crm-status-mapping.service';
import { CrmSyncLockService } from './crm-sync-lock.service';

describe('CrmStatusSyncService', () => {
  const mockPrisma = {
    lead: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    integration: {
      findUnique: jest.fn(),
    },
    pipelineStatus: {
      findFirst: jest.fn(),
    },
    webhookLog: {
      create: jest.fn(),
      update: jest.fn(),
    },
    leadStatusHistory: {
      create: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };

  const mockCrypto = {} as CredentialCryptoService;
  const mockStatusMapping = {
    isBidirectionalEnabled: jest.fn().mockReturnValue(true),
    resolveInternalStatusId: jest.fn().mockResolvedValue('status-internal'),
    resolveExternalStatusId: jest.fn().mockResolvedValue('status-external'),
  } as unknown as CrmStatusMappingService;

  const mockSyncLock = {
    acquire: jest.fn().mockResolvedValue(true),
    getOrigin: jest.fn().mockResolvedValue(null),
    refresh: jest.fn(),
    release: jest.fn(),
  } as unknown as CrmSyncLockService;

  const mockConfig = { get: jest.fn() } as unknown as ConfigService;

  let service: CrmStatusSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CrmStatusSyncService(
      mockPrisma as never,
      mockCrypto,
      mockStatusMapping,
      mockSyncLock,
      mockConfig,
    );
  });

  it('skips inbound update when internal lock is active', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({
      id: 'int-1',
      status: 'active',
      configJson: { bidirectionalSync: true },
    });
    mockPrisma.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      statusId: 'old-status',
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    (mockSyncLock.acquire as jest.Mock).mockResolvedValue(false);
    (mockSyncLock.getOrigin as jest.Mock).mockResolvedValue('internal');
    mockPrisma.webhookLog.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.applyStatusInbound({
      tenantId: 't1',
      integrationType: IntegrationType.amocrm,
      externalId: 'ext-1',
      externalStatusId: '100',
      updatedAt: '2026-01-02T00:00:00Z',
    });

    expect(result).toEqual({ applied: false, reason: 'internal_lock' });
    expect(mockPrisma.lead.update).not.toHaveBeenCalled();
  });

  it('rejects overwritten inbound change when lead was updated later internally', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({
      id: 'int-1',
      status: 'active',
      configJson: { bidirectionalSync: true },
    });
    mockPrisma.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      statusId: 'other-status',
      updatedAt: new Date('2026-01-03T00:00:00Z'),
    });
    mockPrisma.webhookLog.create.mockResolvedValue({ id: 'log-1' });

    const result = await service.applyStatusInbound({
      tenantId: 't1',
      integrationType: IntegrationType.amocrm,
      externalId: 'ext-1',
      externalStatusId: '100',
      updatedAt: '2026-01-02T00:00:00Z',
    });

    expect(result).toEqual({ applied: false, reason: 'overwritten' });
    expect(mockPrisma.webhookLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: WebhookDirection.in,
          status: WebhookLogStatus.failed,
        }),
      }),
    );
  });
});
