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
    getTenantVersion: jest.fn().mockResolvedValue(0),
    invalidateTenant: jest.fn(),
  };

  const mockChatFunnel = {
    getChatFunnel: jest.fn().mockResolvedValue({
      stages: [],
      byUtmSource: [],
      byLandingPage: [],
    }),
  };

  let service: ReportBuilderService;

  beforeEach(() => {
    jest.clearAllMocks();
    const mockConfig = { get: jest.fn().mockReturnValue(90) };
    service = new ReportBuilderService(
      mockPrisma as never,
      mockCache as unknown as AnalyticsCacheService,
      mockChatFunnel as never,
      mockConfig as never,
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

  it('counts leads for full calendar day when to is date-only', async () => {
    mockPrisma.dialog.count.mockResolvedValue(2);
    mockPrisma.lead.count.mockResolvedValue(1);
    mockPrisma.message.count.mockResolvedValue(5);
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockCache.get.mockResolvedValue(null);

    await service.getTenantStatistics('tenant-1', '2026-08-02', '2026-08-02');

    expect(mockPrisma.lead.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        archived: false,
        createdAt: {
          gte: new Date('2026-08-02T00:00:00.000Z'),
          lte: new Date('2026-08-02T23:59:59.999Z'),
        },
      },
    });
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
      chatFunnel: { stages: [], byUtmSource: [], byLandingPage: [] },
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
