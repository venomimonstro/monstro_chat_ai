import { MarginAnalyticsService } from './margin-analytics.service';
import { SemanticCacheService } from '../../ai/services/semantic-cache.service';

describe('MarginAnalyticsService', () => {
  const mockPrisma = {
    tenant: { findUnique: jest.fn(), findMany: jest.fn() },
    transaction: { aggregate: jest.fn() },
    lLMUsageLog: { aggregate: jest.fn() },
  };

  const mockCache = {
    getHitCount: jest.fn().mockResolvedValue(5),
  };

  const mockConfig = {
    get: jest.fn().mockReturnValue(90),
  };

  let service: MarginAnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarginAnalyticsService(
      mockPrisma as never,
      mockCache as unknown as SemanticCacheService,
      mockConfig as never,
    );
  });

  it('calculates margin as revenue minus llm cost in rub', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 't1',
      name: 'Test Co',
    });
    mockPrisma.transaction.aggregate.mockResolvedValue({
      _sum: { amount: 10000 },
      _count: 2,
    });
    mockPrisma.lLMUsageLog.aggregate.mockResolvedValue({
      _sum: { costUsd: 10 },
      _count: 100,
    });

    const result = await service.getTenantMargin('t1');

    expect(result.revenueRub).toBe(10000);
    expect(result.llmCostUsd).toBe(10);
    expect(result.llmCostRub).toBe(900);
    expect(result.marginRub).toBe(9100);
    expect(result.marginPercent).toBe(91);
    expect(result.cacheHitCount).toBe(5);
  });
});
