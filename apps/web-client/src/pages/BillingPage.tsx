import { useEffect, useState } from 'react';
import type {
  BillingOverviewDto,
  PaymentHistoryDto,
  TariffDto,
  TransactionDto,
} from '@ai-consultant/shared-types';
import {
  createCheckout,
  fetchBillingOverview,
  fetchPayments,
  fetchTariffs,
  fetchTransactions,
} from '../lib/billing';
import { extractErrorMessage } from '../lib/errors';
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState';

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU');
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color =
    percent >= 100
      ? 'bg-red-500'
      : percent >= 95
        ? 'bg-orange-500'
        : percent >= 80
          ? 'bg-amber-500'
          : 'bg-brand-600';

  return (
    <div className="mt-4">
      <div className="mb-1 flex justify-between text-sm text-slate-600">
        <span>Сообщения в этом месяце</span>
        <span>
          {used} / {limit}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    succeeded: 'bg-emerald-100 text-emerald-800',
    canceled: 'bg-red-100 text-red-800',
    refunded: 'bg-slate-100 text-slate-800',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? 'bg-slate-100 text-slate-800'}`}>
      {status}
    </span>
  );
}

export function BillingPage() {
  const [overview, setOverview] = useState<BillingOverviewDto | null>(null);
  const [tariffs, setTariffs] = useState<TariffDto[]>([]);
  const [payments, setPayments] = useState<PaymentHistoryDto[]>([]);
  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, t, p, tx] = await Promise.all([
        fetchBillingOverview(),
        fetchTariffs(),
        fetchPayments(),
        fetchTransactions(),
      ]);
      setOverview(ov);
      setTariffs(t);
      setPayments(p);
      setTransactions(tx);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  async function handleCheckout(tariffId: string) {
    setCheckoutLoading(tariffId);
    try {
      const result = await createCheckout(tariffId);
      if (result.confirmationUrl) {
        window.location.href = result.confirmationUrl;
      } else {
        setError('ЮKassa не вернул ссылку для оплаты');
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setCheckoutLoading(null);
    }
  }

  if (loading) return <LoadingState message="Загрузка биллинга…" />;
  if (error) return <ErrorState message={error} onRetry={loadAll} />;
  if (!overview) return null;

  const currentTariffId = overview.subscription?.tariffId;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Тариф и оплата</h1>
        <p className="mt-1 text-slate-500">
          Управление подпиской, история платежей и чеки
        </p>
      </div>

      {overview.tenantStatus === 'trial_expired' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          Пробный период закончился. Оформите подписку, чтобы продолжить работу.
        </div>
      )}

      {overview.trialDaysLeft !== null && overview.trialDaysLeft > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          Пробный период: осталось {overview.trialDaysLeft}{' '}
          {overview.trialDaysLeft === 1
            ? 'день'
            : overview.trialDaysLeft < 5
              ? 'дня'
              : 'дней'}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Текущий статус</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-slate-500">Подписка</p>
            <p className="mt-1 font-medium text-slate-900">
              {overview.subscription?.tariff?.name ?? '—'}
            </p>
            <p className="text-xs text-slate-500">
              {overview.subscription?.status ?? overview.tenantStatus}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Баланс</p>
            <p className="mt-1 font-medium text-slate-900">
              {formatPrice(overview.balance, 'RUB')}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Политика перерасхода</p>
            <p className="mt-1 font-medium text-slate-900">
              {overview.usage.overagePolicy === 'block' && 'Блокировка'}
              {overview.usage.overagePolicy === 'charge' && 'Списание с баланса'}
              {overview.usage.overagePolicy === 'allow' && 'Без ограничений'}
            </p>
          </div>
        </div>
        <UsageBar used={overview.usage.used} limit={overview.usage.limit} />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Сравнение тарифов
        </h2>
        {tariffs.length > 0 && (
          <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-4 py-3 font-medium">Параметр</th>
                  {tariffs.map((t) => (
                    <th
                      key={t.id}
                      className={`px-4 py-3 font-medium ${
                        t.id === currentTariffId ? 'text-brand-700' : ''
                      }`}
                    >
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <CompareRow label="Цена" tariffs={tariffs} currentId={currentTariffId}>
                  {(t) => (
                    <>
                      {formatPrice(t.price, t.currency)}
                      <span className="text-slate-400">
                        /{t.period === 'month' ? 'мес' : 'год'}
                      </span>
                    </>
                  )}
                </CompareRow>
                <CompareRow label="Сообщений" tariffs={tariffs} currentId={currentTariffId}>
                  {(t) => t.messageLimit.toLocaleString('ru-RU')}
                </CompareRow>
                <CompareRow label="Источников" tariffs={tariffs} currentId={currentTariffId}>
                  {(t) => t.sourceLimit}
                </CompareRow>
                <CompareRow label="База знаний" tariffs={tariffs} currentId={currentTariffId}>
                  {(t) => `${t.kbLimitMb} МБ`}
                </CompareRow>
                <CompareRow label="Перерасход" tariffs={tariffs} currentId={currentTariffId}>
                  {(t) =>
                    t.overagePolicy === 'block'
                      ? 'Блокировка'
                      : t.overagePolicy === 'charge'
                        ? 'Списание'
                        : 'Без ограничений'
                  }
                </CompareRow>
              </tbody>
            </table>
          </div>
        )}

        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Доступные тарифы
        </h2>
        {tariffs.length === 0 ? (
          <EmptyState title="Нет доступных тарифов" description="Обратитесь в поддержку, чтобы активировать тарифы." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {tariffs.map((tariff) => {
              const isCurrent = tariff.id === currentTariffId;
              return (
                <div
                  key={tariff.id}
                  className={`rounded-xl border p-5 shadow-sm ${
                    isCurrent
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <h3 className="text-lg font-semibold text-slate-900">
                    {tariff.name}
                  </h3>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {formatPrice(tariff.price, tariff.currency)}
                    <span className="text-sm font-normal text-slate-500">
                      /{tariff.period === 'month' ? 'мес' : 'год'}
                    </span>
                  </p>
                  <ul className="mt-4 space-y-1 text-sm text-slate-600">
                    <li>{tariff.messageLimit.toLocaleString('ru-RU')} сообщений</li>
                    <li>{tariff.sourceLimit} источников</li>
                    <li>{tariff.kbLimitMb} МБ базы знаний</li>
                  </ul>
                  {isCurrent ? (
                    <p className="mt-4 text-sm font-medium text-brand-700">
                      Текущий тариф
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCheckout(tariff.id)}
                      disabled={checkoutLoading === tariff.id}
                      className="mt-4 w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {checkoutLoading === tariff.id ? 'Создание платежа…' : 'Оплатить'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">История платежей</h2>
        {payments.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Пока нет платежей</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">Дата</th>
                  <th className="py-2">Сумма</th>
                  <th className="py-2">Описание</th>
                  <th className="py-2">Статус</th>
                  <th className="py-2">Чек</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-100">
                    <td className="py-2">{formatDate(payment.createdAt)}</td>
                    <td className="py-2">
                      {formatPrice(payment.amount, payment.currency)}
                    </td>
                    <td className="py-2">{payment.description ?? '—'}</td>
                    <td className="py-2">
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="py-2">
                      {payment.receiptUrl ? (
                        <a
                          href={payment.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-600 hover:underline"
                        >
                          Скачать
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">История операций</h2>
        {transactions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Пока нет операций</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2">Дата</th>
                  <th className="py-2">Тип</th>
                  <th className="py-2">Сумма</th>
                  <th className="py-2">Описание</th>
                  <th className="py-2">Период</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-100">
                    <td className="py-2">{formatDate(tx.createdAt)}</td>
                    <td className="py-2">{tx.type}</td>
                    <td className="py-2">
                      {formatPrice(tx.amount, tx.currency)}
                    </td>
                    <td className="py-2">{tx.description ?? '—'}</td>
                    <td className="py-2">
                      {tx.periodStart && tx.periodEnd
                        ? `${formatDate(tx.periodStart)} — ${formatDate(tx.periodEnd)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CompareRow({
  label,
  tariffs,
  currentId,
  children,
}: {
  label: string;
  tariffs: TariffDto[];
  currentId?: string;
  children: (t: TariffDto) => React.ReactNode;
}) {
  return (
    <tr className="border-b border-slate-100">
      <td className="px-4 py-3 font-medium text-slate-700">{label}</td>
      {tariffs.map((t) => (
        <td
          key={t.id}
          className={`px-4 py-3 ${t.id === currentId ? 'bg-brand-50' : ''}`}
        >
          {children(t)}
        </td>
      ))}
    </tr>
  );
}
