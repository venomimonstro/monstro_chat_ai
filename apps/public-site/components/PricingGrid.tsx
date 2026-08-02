'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { TariffDto } from '@ai-consultant/shared-types';
import { CheckIcon } from './icons';
import { isUuid } from '@/lib/uuid';

interface PricingGridProps {
  tariffs: TariffDto[];
}

export function PricingGrid({ tariffs }: PricingGridProps) {
  const [period, setPeriod] = useState<'month' | 'year'>('month');

  const visible = useMemo(() => {
    const monthly = tariffs.filter((t) => t.period === 'month' && t.isActive);
    if (period === 'month') return monthly;
    return monthly.map((t) => ({
      ...t,
      price: Math.round(t.price * 10),
      period: 'year' as const,
    }));
  }, [tariffs, period]);

  const features = [
    'ИИ-ответы по базе знаний',
    'Сбор лидов и CRM',
    'Интеграции amoCRM / Битрикс24',
    'Аналитика и отчёты',
    'Email-поддержка',
  ];

  return (
    <div>
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setPeriod('month')}
          className={`rounded-full px-5 py-2 text-sm font-medium transition ${
            period === 'month'
              ? 'bg-brand-600 text-white shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
          aria-pressed={period === 'month'}
        >
          Помесячно
        </button>
        <button
          type="button"
          onClick={() => setPeriod('year')}
          className={`rounded-full px-5 py-2 text-sm font-medium transition ${
            period === 'year'
              ? 'bg-brand-600 text-white shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
          aria-pressed={period === 'year'}
        >
          За год <span className="ml-1 text-xs opacity-90">−17%</span>
        </button>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {visible.map((tariff) => {
          return (
            <div
              key={tariff.id}
              className="relative flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-card transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-soft"
            >
              <h3 className="text-lg font-semibold text-slate-900">{tariff.name}</h3>
              <p className="mt-4 text-4xl font-bold tracking-tight text-slate-900">
                {tariff.price.toLocaleString('ru-RU')}
                <span className="text-lg font-medium text-slate-500"> ₽</span>
                <span className="text-sm font-normal text-slate-500">
                  /{period === 'month' ? 'мес' : 'год'}
                </span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckIcon /> {tariff.messageLimit.toLocaleString('ru-RU')} сообщений
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon /> {tariff.sourceLimit} источников
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon /> {tariff.kbLimitMb} МБ базы знаний
                </li>
                {features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckIcon /> {feature}
                  </li>
                ))}
              </ul>
              <Link
                href={
                  isUuid(tariff.id)
                    ? `/register?tariffId=${encodeURIComponent(tariff.id)}`
                    : `/register?tariffName=${encodeURIComponent(tariff.name)}`
                }
                className="mt-8 block rounded-full bg-brand-600 py-2.5 text-center text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Начать бесплатно
              </Link>
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-center text-sm text-slate-500">
        7 дней триала без привязки карты. Все тарифы включают базовую поддержку.
      </p>
    </div>
  );
}
