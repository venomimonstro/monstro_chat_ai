import { api } from './api';
import { withRetry } from './retry';
import type {
  BillingOverviewDto,
  CheckoutResponseDto,
  PaymentHistoryDto,
  TariffDto,
  TransactionDto,
} from '@ai-consultant/shared-types';

export async function fetchBillingOverview() {
  return withRetry(() => api.get<BillingOverviewDto>('/billing/overview').then((r) => r.data));
}

export async function fetchTariffs() {
  return withRetry(() => api.get<TariffDto[]>('/billing/tariffs').then((r) => r.data));
}

export async function createCheckout(tariffId: string) {
  const res = await api.post<CheckoutResponseDto>('/billing/checkout', {
    tariffId,
  });
  return res.data;
}

export async function fetchPayments() {
  return withRetry(() => api.get<PaymentHistoryDto[]>('/billing/payments').then((r) => r.data));
}

export async function fetchTransactions() {
  return withRetry(() => api.get<TransactionDto[]>('/billing/transactions').then((r) => r.data));
}
