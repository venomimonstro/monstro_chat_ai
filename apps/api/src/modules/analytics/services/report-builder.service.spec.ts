import { ReportBuilderService } from './report-builder.service';
import { AnalyticsCacheService } from './analytics-cache.service';

describe('ReportBuilderService', () => {
  const mockPrisma = {
    $queryRaw: jest.fn(),
    dialog: { count: jest.fn() },
    lead: { count: jest.fn() },
    message: { count: jest.fn() },
  };

  const mockCache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
  };

  let service: ReportBuilderService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportBuilderService(
      mockPrisma as never,
      mockCache as unknown as AnalyticsCacheService,
    );
  });

  it('aggregates MRR by tariff from transactions', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { label: 'Pro', value: { toString: () => '15000' } },
      { label: 'Start', value: { toString: () => '5000' } },
    ]);

    const result = await service.query({
      metric: 'mrr',
      dimension: 'tariff',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.999Z',
    });

    expect(result.total).toBe(20000);
    expect(result.series).toEqual([
      { label: 'Pro', value: 15000 },
      { label: 'Start', value: 5000 },
    ]);
    expect(mockCache.set).toHaveBeenCalled();
  });

  it('returns cached tenant statistics when available', async () => {
    const cached = {
      from: '2026-01-01',
      to: '2026-01-31',
      dialogs: 10,
      leads: 3,
      messages: 50,
      conversionRate: 30,
      funnel: [],
      dialogsByDay: [],
      leadsByDay: [],
    };
    mockCache.get.mockResolvedValueOnce(cached);

    const result = await service.getTenantStatistics(
      'tenant-1',
      '2026-01-01',
      '2026-01-31',
    );

    expect(result).toEqual(cached);
    expect(mockPrisma.dialog.count).not.toHaveBeenCalled();
  });
});
