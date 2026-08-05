import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { KnowledgeService } from './knowledge.service';
import { IndexingPipelineService } from './services/indexing-pipeline.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_CRAWL_SITE, QUEUE_INGEST_DOCUMENT } from './constants';

describe('KnowledgeService', () => {
  let service: KnowledgeService;

  const mockPrisma = {
    source: { findFirst: jest.fn(), update: jest.fn() },
    indexingJob: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    knowledgeDocument: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
    knowledgeChunk: { count: jest.fn(), deleteMany: jest.fn() },
    tenant: { findUnique: jest.fn() },
  };

  const mockCrawlQueue = { add: jest.fn() };
  const mockIngestQueue = { add: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: IndexingPipelineService, useValue: {} },
        { provide: getQueueToken(QUEUE_CRAWL_SITE), useValue: mockCrawlQueue },
        {
          provide: getQueueToken(QUEUE_INGEST_DOCUMENT),
          useValue: mockIngestQueue,
        },
      ],
    }).compile();
    service = module.get(KnowledgeService);
  });

  it('throws when source not found for crawl', async () => {
    mockPrisma.source.findFirst.mockResolvedValue(null);
    await expect(
      service.startCrawl('t1', 'missing', 'https://example.com'),
    ).rejects.toThrow(NotFoundException);
  });

  it('queues crawl job when source exists', async () => {
    mockPrisma.source.findFirst.mockResolvedValue({
      id: 's1',
      tenantId: 't1',
      configJson: { training: { siteProfile: 'small', excludeBlog: true } },
    });
    mockPrisma.indexingJob.findFirst.mockResolvedValue(null);
    mockPrisma.tenant.findUnique.mockResolvedValue({
      tariff: { kbLimitMb: 100, featuresJson: {} },
      subscriptions: [],
    });
    mockPrisma.indexingJob.create.mockResolvedValue({
      id: 'j1',
      tenantId: 't1',
      sourceId: 's1',
      type: 'crawl',
      status: 'queued',
      rootUrl: 'https://example.com',
      totalPages: 50,
      processedPages: 0,
      errorMessage: null,
      statsJson: { mode: 'full' },
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
    });

    const result = await service.startCrawl(
      't1',
      's1',
      'https://example.com',
    );

    expect(mockCrawlQueue.add).toHaveBeenCalledWith(
      'crawl',
      expect.objectContaining({
        mode: 'full',
        crawlOptions: expect.objectContaining({
          pageLimit: 20,
          strategy: expect.objectContaining({ siteProfile: 'small' }),
        }),
      }),
      expect.any(Object),
    );
    expect(result.id).toBe('j1');
  });

  it('rejects crawl when job already running', async () => {
    mockPrisma.source.findFirst.mockResolvedValue({ id: 's1', tenantId: 't1' });
    mockPrisma.indexingJob.findFirst.mockResolvedValue({ id: 'running' });

    await expect(
      service.startCrawl('t1', 's1', 'https://example.com'),
    ).rejects.toThrow(ConflictException);
  });

  it('startReindex uses last completed crawl url in incremental mode', async () => {
    mockPrisma.source.findFirst.mockResolvedValue({
      id: 's1',
      tenantId: 't1',
      configJson: {},
    });
    mockPrisma.indexingJob.findFirst.mockImplementation((args: unknown) => {
      const where = (args as { where?: Record<string, unknown> })?.where;
      if (Array.isArray((where?.status as { in?: unknown })?.in)) {
        return Promise.resolve(null);
      }
      if (where?.status === 'completed') {
        return Promise.resolve({
          rootUrl: 'https://example.com',
          completedAt: new Date(),
          statsJson: null,
        });
      }
      return Promise.resolve(null);
    });
    mockPrisma.tenant.findUnique.mockResolvedValue({
      tariff: { kbLimitMb: 100, featuresJson: {} },
      subscriptions: [],
    });
    mockPrisma.indexingJob.create.mockResolvedValue({
      id: 'j2',
      tenantId: 't1',
      sourceId: 's1',
      type: 'crawl',
      status: 'queued',
      rootUrl: 'https://example.com',
      totalPages: 50,
      processedPages: 0,
      errorMessage: null,
      statsJson: { mode: 'incremental' },
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
    });

    await service.startReindex('t1', 's1');

    expect(mockCrawlQueue.add).toHaveBeenCalledWith(
      'crawl',
      expect.objectContaining({
        rootUrl: 'https://example.com',
        mode: 'incremental',
      }),
      expect.any(Object),
    );
  });

  it('startReindex fails without prior crawl', async () => {
    mockPrisma.source.findFirst.mockResolvedValue({ id: 's1', tenantId: 't1' });
    mockPrisma.indexingJob.findFirst.mockResolvedValue(null);

    await expect(service.startReindex('t1', 's1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deleteDocument returns chunk count', async () => {
    mockPrisma.knowledgeDocument.findFirst.mockResolvedValue({
      id: 'd1',
      tenantId: 't1',
      fileKey: 'key/file.pdf',
    });
    mockPrisma.knowledgeChunk.count.mockResolvedValue(5);
    mockPrisma.knowledgeDocument.delete.mockResolvedValue({});

    const result = await service.deleteDocument('t1', 'd1');
    expect(result.deletedChunks).toBe(5);
    expect(mockPrisma.knowledgeDocument.delete).toHaveBeenCalledWith({
      where: { id: 'd1' },
    });
  });
});
