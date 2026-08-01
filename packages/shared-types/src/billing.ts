export type OveragePolicy = 'block' | 'charge' | 'allow';

export type PaymentStatus = 'pending' | 'succeeded' | 'canceled' | 'refunded';

export type TransactionType =
  | 'payment'
  | 'refund'
  | 'subscription_renewal'
  | 'balance_topup'
  | 'correction';

export interface TariffDto {
  id: string;
  name: string;
  price: number;
  period: 'month' | 'year';
  currency: string;
  messageLimit: number;
  sourceLimit: number;
  kbLimitMb: number;
  overagePolicy: OveragePolicy;
  features: Record<string, unknown>;
  isActive: boolean;
  activeSubscriptions?: number;
}

export interface SubscriptionDto {
  id: string;
  tariffId: string;
  status: string;
  currentPeriodEnd: string | null;
  tariff: TariffDto | null;
}

export interface UsageDto {
  periodKey: string;
  used: number;
  limit: number;
  percent: number;
  overagePolicy: OveragePolicy;
}

export interface BillingOverviewDto {
  tenantStatus: string;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  balance: number;
  subscription: SubscriptionDto | null;
  usage: UsageDto;
}

export interface TransactionDto {
  id: string;
  paymentId: string | null;
  subscriptionId: string | null;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  receiptUrl: string | null;
  createdAt: string;
}

export interface PaymentHistoryDto {
  id: string;
  yooKassaPaymentId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string | null;
  confirmationUrl: string | null;
  receiptUrl: string | null;
  createdAt: string;
}

export interface CheckoutResponseDto {
  paymentId: string;
  confirmationUrl: string;
}
