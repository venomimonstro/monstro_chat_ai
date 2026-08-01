import { Link } from 'react-router-dom';

export function BillingFailedPage() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <span className="text-2xl text-red-600">✕</span>
      </div>
      <h1 className="text-xl font-semibold text-slate-900">Оплата не прошла</h1>
      <p className="mt-2 text-sm text-slate-500">
        Платёж был отменён или произошла ошибка. Попробуйте ещё раз или выберите
        другой способ оплаты.
      </p>
      <Link
        to="/billing"
        className="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Вернуться к тарифам
      </Link>
    </div>
  );
}
