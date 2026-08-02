import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SourcesService } from './sources.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_SOURCE_CONFIG } from '@ai-consultant/shared-types';

describe('SourcesService', () => {
  let service: SourcesService;

  const mockPrisma = {
    source: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    tenant: { findUnique: jest.fn() },
    tariff: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourcesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<SourcesService>(SourcesService);
  });

  it('should generate unique widget keys', () => {
    const k1 = service.generateWidgetKey();
    const k2 = service.generateWidgetKey();
    expect(k1).toMatch(/^wk_/);
    expect(k1).not.toBe(k2);
  });

  it('should throw LIMIT_EXCEEDED when source limit reached', async () => {
    mockPrisma.source.count.mockResolvedValue(1);
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 't1',
      tariff: { sourceLimit: 1 },
      subscriptions: [],
    });

    await expect(
      service.create('t1', { name: 'Test' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should record ping and set script_installed_at', async () => {
    const now = new Date();
    mockPrisma.source.findUnique.mockResolvedValue({
      id: 's1',
      widgetKey: 'wk_test',
      scriptInstalledAt: null,
    });
    mockPrisma.source.update.mockResolvedValue({
      id: 's1',
      scriptInstalledAt: now,
    });

    const result = await service.recordPing('wk_test');
    expect(result.ok).toBe(true);
    expect(mockPrisma.source.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: expect.objectContaining({ lastSeenAt: expect.any(Date) }),
      }),
    );
  });

  it('should return not found for unknown widget key ping', async () => {
    mockPrisma.source.findUnique.mockResolvedValue(null);
    await expect(service.recordPing('wk_missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should create source with default config', async () => {
    mockPrisma.source.count.mockResolvedValue(0);
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 't1',
      tariff: { sourceLimit: 3 },
      subscriptions: [],
    });
    mockPrisma.source.create.mockResolvedValue({
      id: 's1',
      tenantId: 't1',
      type: 'website',
      name: 'Main',
      widgetKey: 'wk_abc',
      status: 'active',
      configJson: DEFAULT_SOURCE_CONFIG,
      configVersion: 1,
      scriptInstalledAt: null,
      lastSeenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.create('t1', { name: 'Main' });
    expect(result.widgetKey).toBe('wk_abc');
    expect(result.config.appearance.primaryColor).toBe('#EF2B34');
  });
});
