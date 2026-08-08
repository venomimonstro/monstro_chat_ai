import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { PromptGenerationService } from './prompt-generation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CrawlerService } from '../knowledge/services/crawler.service';
import { ProviderRegistryService } from '../ai/providers/provider-registry.service';
import { PromptsService } from './prompts.service';

describe('PromptGenerationService', () => {
  let service: PromptGenerationService;

  const mockPrisma = {
    source: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'source-1',
        tenantId: 'tenant-1',
        name: 'Сайт компании',
      }),
    },
  };

  const mockCrawler = {
    fetchPagesForPrompt: jest.fn().mockResolvedValue({
      pages: [
        {
          url: 'https://example.com/',
          title: 'Главная',
          text: 'Мы продаём мебель онлайн с доставкой по России.',
        },
      ],
      errors: [],
    }),
  };

  const mockProvider = {
    name: 'openrouter',
    defaultModel: 'test-model',
    streamChat: jest.fn(async function* () {
      yield { content: 'Ты консультант мебельного магазина.', done: false };
      yield { content: '', done: true };
    }),
  };

  const mockProviders = {
    getChain: jest.fn().mockReturnValue([mockProvider]),
  };

  const mockPrompts = {
    getPromptCharLimit: jest.fn().mockResolvedValue(4000),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptGenerationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: { getClient: () => null } },
        { provide: CrawlerService, useValue: mockCrawler },
        { provide: ProviderRegistryService, useValue: mockProviders },
        { provide: PromptsService, useValue: mockPrompts },
        {
          provide: ConfigService,
          useValue: { get: () => 30 },
        },
      ],
    }).compile();

    service = module.get(PromptGenerationService);
  });

  it('generates prompt from fetched pages', async () => {
    const result = await service.generateFromUrls({
      tenantId: 'tenant-1',
      sourceId: 'source-1',
      urls: ['https://example.com'],
    });

    expect(result.content).toContain('консультант');
    expect(result.pages).toHaveLength(1);
    expect(mockCrawler.fetchPagesForPrompt).toHaveBeenCalledWith(
      ['https://example.com'],
      5,
    );
  });

  it('rejects empty url list', async () => {
    await expect(
      service.generateFromUrls({
        tenantId: 'tenant-1',
        sourceId: 'source-1',
        urls: ['  '],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
