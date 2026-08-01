import { UsageLimitExceededException } from '../billing.errors';
import { UsageLimitService } from './usage-limit.service';
import { TariffResolverService } from './tariff-resolver.service';

describe('UsageLimitService', () => {
  const mockPrisma = {
    tenant: { findUnique: jest.fn(), update: jest.fn() },
    usageCounter: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    usageNotification: { create: jest.fn(), findUnique: jest.fn() },
    user: { findFirst: jest.fn() },
  };

  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    connect: jest.fn(),
  };

  const mockRedis = {
    getClient: jest.fn(() => mockRedisClient),
  };

  const mockEmail = { sendUsageThreshold: jest.fn() };
  const mockNotifications = { create: jest.fn().mockResolvedValue({}) };

  const mockTariffResolver = {
    getEffectiveTariff: jest.fn(),
    getActiveSubscription: jest.fn(),
  };

  let service: UsageLimitService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTariffResolver.getEffectiveTariff.mockResolvedValue({
      messageLimit: 5000,
      overagePolicy: 'block',
      price: 990,
    });
    mockTariffResolver.getActiveSubscription.mockResolvedValue({
      status: 'active',
    });
    mockPrisma.tenant.findUnique.mockResolvedValue({
      id: 't1',
      status: 'active',
      trialEndsAt: null,
      balance: 0,
    });
    mockRedisClient.get.mockResolvedValue('5000');

    service = new UsageLimitService(
      mockPrisma as never,
      mockRedis as never,
      mockEmail as never,
      mockNotifications as never,
      mockTariffResolver as unknown as TariffResolverService,
    );
  });

  it('blocks message when usage equals limit with block policy', async () => {
    await expect(service.assertCanSendMessage('t1')).rejects.toBeInstanceOf(
      UsageLimitExceededException,
    );
  });

  it('allows message below limit', async () => {
    mockRedisClient.get.mockResolvedValue('4999');
    await expect(service.assertCanSendMessage('t1')).resolves.toBeUndefined();
  });

  it('sends 80% notification only once per period', async () => {
    mockPrisma.usageNotification.create
      .mockRejectedValueOnce(new Error('unique'))
      .mockResolvedValueOnce({ id: 'n1' });
    mockPrisma.user.findFirst.mockResolvedValue({ email: 'user@test.com' });
    mockTariffResolver.getEffectiveTariff.mockResolvedValue({
      messageLimit: 100,
      overagePolicy: 'block',
    });

    await service.checkThresholdNotifications('t1', '2026-07', 80);
    await service.checkThresholdNotifications('t1', '2026-07', 81);

    expect(mockEmail.sendUsageThreshold).toHaveBeenCalledTimes(1);
    expect(mockEmail.sendUsageThreshold).toHaveBeenCalledWith(
      'user@test.com',
      80,
      81,
      100,
    );
  });

  it('hydrates redis from postgres on startup', async () => {
    mockPrisma.usageCounter.findMany.mockResolvedValue([
      { tenantId: 't1', messageCount: 42 },
    ]);
    mockRedisClient.get.mockResolvedValue(null);

    await service.hydrateRedisFromPostgres();

    expect(mockRedisClient.set).toHaveBeenCalledWith(
      expect.stringContaining('usage:t1:'),
      '42',
    );
  });
});
