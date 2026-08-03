import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { CrmStatusMappingService } from './crm-status-mapping.service';

describe('CrmStatusMappingService', () => {
  const mockPrisma: {
    integration: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    pipeline: {
      findFirst: jest.Mock;
    };
    statusMapping: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    $transaction: jest.Mock;
  } = {
    integration: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    pipeline: {
      findFirst: jest.fn(),
    },
    statusMapping: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  mockPrisma.$transaction.mockImplementation(
    (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
  );

  const mockConfig = {
    get: jest.fn((key: string) =>
      key === 'API_PUBLIC_URL' ? 'http://api.test' : undefined,
    ),
  } as unknown as ConfigService;

  let service: CrmStatusMappingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CrmStatusMappingService(mockPrisma as never, mockConfig);
    mockPrisma.integration.findUnique.mockResolvedValue({
      id: 'int-1',
      status: 'active',
      configJson: {},
    });
    mockPrisma.pipeline.findFirst.mockResolvedValue({
      statuses: [
        { id: 's1', name: 'Новый', sortOrder: 0, color: '#000' },
        { id: 's2', name: 'В работе', sortOrder: 1, color: '#111' },
      ],
    });
    mockPrisma.statusMapping.findMany.mockResolvedValue([]);
  });

  it('rejects incomplete mapping when bidirectional sync enabled', async () => {
    await expect(
      service.saveMapping('t1', 'amocrm', {
        bidirectionalSync: true,
        mappings: [{ internalStatusId: 's1', externalStatusId: '100' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns webhook url in mapping response', async () => {
    const result = await service.getMapping('t1', 'amocrm');
    expect(result.webhookUrl).toBe(
      'http://api.test/api/integrations/webhooks/amocrm/t1',
    );
    expect(result.bidirectionalSync).toBe(false);
  });

  it('saves complete mapping and enables bidirectional sync', async () => {
    mockPrisma.statusMapping.findMany.mockResolvedValue([
      { internalStatusId: 's1', externalStatusId: '100' },
      { internalStatusId: 's2', externalStatusId: '200' },
    ]);
    mockPrisma.integration.update.mockResolvedValue({});

    await service.saveMapping('t1', 'amocrm', {
      bidirectionalSync: true,
      mappings: [
        { internalStatusId: 's1', externalStatusId: '100' },
        { internalStatusId: 's2', externalStatusId: '200' },
      ],
    });

    expect(mockPrisma.statusMapping.createMany).toHaveBeenCalled();
    expect(mockPrisma.integration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          configJson: expect.objectContaining({ bidirectionalSync: true }),
        }),
      }),
    );
  });
});
