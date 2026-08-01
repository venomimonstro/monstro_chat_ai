import { CheckoutService } from './checkout.service';
import { YooKassaFactoryService } from './yookassa-factory.service';
import { TariffResolverService } from './tariff-resolver.service';

describe('CheckoutService', () => {
  const mockPrisma = {
    tariff: { findUnique: jest.fn() },
    payment: { create: jest.fn(), update: jest.fn() },
  };

  const mockFactory = { getClient: jest.fn() };
  const mockResolver = {} as TariffResolverService;
  const mockConfig = { get: jest.fn().mockReturnValue('http://localhost:5173/billing/success') };

  let service: CheckoutService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CheckoutService(
      mockPrisma as never,
      mockFactory as unknown as YooKassaFactoryService,
      mockResolver,
      mockConfig as never,
    );
  });

  it('throws if yookassa is not configured', async () => {
    mockPrisma.tariff.findUnique.mockResolvedValue({ id: 'tariff-1', price: 990, currency: 'RUB' });
    mockFactory.getClient.mockReturnValue(null);
    mockPrisma.payment.create.mockResolvedValue({ id: 'p1' });

    await expect(service.checkout('t1', 'tariff-1')).rejects.toThrow('ЮKassa не настроена');
  });
});
