import { Prisma } from '@prisma/client';
import { WebhookService } from './webhook.service';
import { YooKassaFactoryService } from './yookassa-factory.service';

describe('WebhookService', () => {
  const mockPrisma = {
    payment: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    transaction: { create: jest.fn() },
    subscription: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    tariff: { findUnique: jest.fn() },
    tenant: { update: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockFactory = { getClient: jest.fn() };

  let service: WebhookService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WebhookService(
      mockPrisma as never,
      mockFactory as unknown as YooKassaFactoryService,
    );
  });

  it('ignores duplicate payment.succeeded for same payment', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      status: 'succeeded',
      amount: new Prisma.Decimal(990),
      currency: 'RUB',
      metadataJson: { tariffId: 'tariff-1' },
      tenant: { id: 't1' },
    });

    const result = await service.handle({
      event: 'payment.succeeded',
      object: {
        id: 'yoo-1',
        status: 'succeeded',
        amount: { value: '990.00', currency: 'RUB' },
        payment_method: { id: 'pm-1' },
      },
    });

    expect(result).toEqual({ received: true });
    expect(mockPrisma.payment.update).not.toHaveBeenCalled();
  });

  it('canceled payment updates status without transaction', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      status: 'pending',
      amount: new Prisma.Decimal(990),
      currency: 'RUB',
      metadataJson: {},
      tenant: { id: 't1' },
    });

    await service.handle({
      event: 'payment.canceled',
      object: { id: 'yoo-1', status: 'canceled', amount: { value: '990.00', currency: 'RUB' } },
    });

    expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', status: { in: ['pending', 'succeeded'] } },
      data: { status: 'canceled' },
    });
    expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
  });
});
