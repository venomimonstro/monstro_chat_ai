'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

export function LossCalculator() {
  const [visitors, setVisitors] = useState(2000);
  const [avgCheck, setAvgCheck] = useState(8000);

  const lostPerMonth = useMemo(() => {
    // ~85% visitors leave without contact; ~2% could convert with instant chat
    const missed = Math.round(visitors * 0.85 * 0.02 * avgCheck);
    return missed;
  }, [visitors, avgCheck]);

  const formatRub = (n: number) =>
    new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n);

  return (
    <div className="card mx-auto max-w-2xl">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-ink-900">
            Посетителей сайта в месяц
          </label>
          <input
            type="range"
            min={200}
            max={20000}
            step={200}
            value={visitors}
            onChange={(e) => setVisitors(Number(e.target.value))}
            className="mt-2 w-full accent-brand-500"
          />
          <p className="mt-1 text-sm font-semibold text-brand-600">
            {formatRub(visitors)} чел.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-900">
            Средний чек, ₽
          </label>
          <input
            type="range"
            min={1000}
            max={100000}
            step={1000}
            value={avgCheck}
            onChange={(e) => setAvgCheck(Number(e.target.value))}
            className="mt-2 w-full accent-brand-500"
          />
          <p className="mt-1 text-sm font-semibold text-brand-600">
            {formatRub(avgCheck)} ₽
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl bg-brand-50 px-6 py-5 text-center ring-1 ring-brand-100">
        <p className="text-sm text-ink-700">Примерно упускаете каждый месяц</p>
        <p className="mt-1 text-3xl font-extrabold text-brand-600">
          {formatRub(lostPerMonth)} ₽
        </p>
        <p className="mt-2 text-xs text-ink-500">
          Оценка при отсутствии мгновенного ответа на сайте
        </p>
      </div>

      <Link href="/register" className="btn-primary mt-6 w-full text-center">
        Вернуть эти продажи — начать бесплатно
      </Link>
    </div>
  );
}
