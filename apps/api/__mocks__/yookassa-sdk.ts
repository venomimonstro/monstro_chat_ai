export const YooKassa = jest.fn(() => ({
  payments: {
    create: jest.fn().mockResolvedValue({
      id: 'yoo-payment-1',
      confirmation: { confirmation_url: 'http://localhost/yookassa' },
    }),
    load: jest.fn().mockResolvedValue({ id: 'yoo-payment-1', status: 'succeeded' }),
  },
}));

export const CurrencyEnum = {
  RUB: 'RUB',
  EUR: 'EUR',
  USD: 'USD',
} as const;

export const WebhookEventEnum = {
  paymentSucceeded: 'payment.succeeded',
  paymentCanceled: 'payment.canceled',
  refundSucceeded: 'refund.succeeded',
} as const;
