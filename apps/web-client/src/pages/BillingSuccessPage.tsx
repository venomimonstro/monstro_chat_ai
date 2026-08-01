import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchPayments } from '../lib/billing';

export function BillingSuccessPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<
    'loading' | 'success' | 'pending' | 'canceled'
  >('loading');
  const paymentId = searchParams.get('payment_id');

  useEffect(() => {
    if (!paymentId) {
      setStatus('success');
      return;
    }

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const payments = await fetchPayments();
        const payment = payments.find((p) => p.id === paymentId);
        if (payment?.status === 'succeeded') {
          setStatus('success');
          clearInterval(interval);
        } else if (payment?.status === 'canceled') {
          setStatus('canceled');
          clearInterval(interval);
        } else if (attempts > 10) {
          setStatus('pending');
          clearInterval(interval);
        }
      } catch {
        if (attempts > 10) {
          setStatus('pending');
          clearInterval(interval);
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [paymentId]);

  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <span className="text-2xl text-green-600">
          {status === 'canceled' ? '✕' : '✓'}
        </span>
      </div>
      <h1 className="text-xl font-semibold text-slate-900">
        {status === 'loading' && 'Обрабатываем платёж…'}
        {status === 'success' && 'Оплата успешна'}
        {status === 'pending' && 'Платёж обрабатывается'}
        {status === 'canceled' && 'Оплата отменена'}
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        {status === 'success' &&
          'Подписка активирована. Спасибо за оплату!'}
        {status === 'pending' &&
          'Статус обновится в течение нескольких минут. Мы уведомим вас по email.'}
        {status === 'canceled' &&
          'Платёж был отменён. Вы можете попробовать снова в разделе биллинга.'}
      </p>
      <Link
        to="/billing"
        className="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Перейти в биллинг
      </Link>
    </div>
  );
}
