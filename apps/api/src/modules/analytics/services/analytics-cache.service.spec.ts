import { AnalyticsCacheService } from './analytics-cache.service';

describe('AnalyticsCacheService', () => {
  const mockRedis = {
    getClient: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn().mockReturnValue(600),
  };

  let service: AnalyticsCacheService;
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    mockRedis.getClient.mockReturnValue({
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      setex: jest.fn(async (key: string, _ttl: number, value: string) => {
        store.set(key, value);
      }),
    });
    service = new AnalyticsCacheService(mockRedis as never, mockConfig as never);
  });

  it('returns null on cache miss', async () => {
    await expect(service.get({ metric: 'mrr' })).resolves.toBeNull();
  });

  it('stores and retrieves cached values', async () => {
    const payload = { metric: 'mrr', from: '2026-01-01', to: '2026-01-31' };
    const value = { total: 1000 };
    await service.set(payload, value);
    await expect(service.get(payload)).resolves.toEqual(value);
  });
});
