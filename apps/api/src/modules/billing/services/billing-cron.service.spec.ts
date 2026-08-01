import { BillingCronService } from './billing-cron.service';

describe('BillingCronService', () => {
  const mockPrisma = {
    tenant: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockUsageLimit = {
    syncDirtyCountersToPostgres: jest.fn(),
  };

  let service: BillingCronService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BillingCronService(
      mockPrisma as never,
      mockUsageLimit as never,
      {} as never,
    );
  });

  it('expires trial tenants without active paid subscription', async () => {
    const past = new Date('2020-01-01');
    mockPrisma.tenant.findMany.mockResolvedValue([
      {
        id: 't1',
        subscriptions: [{ id: 's1', status: 'trialing', currentPeriodEnd: past }],
      },
    ]);
    mockPrisma.$transaction.mockImplementation(async (fn) => fn(mockPrisma));

    const tx = {
      tenant: { update: jest.fn() },
      subscription: { update: jest.fn() },
    };
    mockPrisma.$transaction.mockImplementation(async (fn) => fn(tx));

    await service.expireTrials();

    expect(tx.tenant.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: 'trial_expired' },
    });
    expect(tx.subscription.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { status: 'canceled' },
    });
  });
});
