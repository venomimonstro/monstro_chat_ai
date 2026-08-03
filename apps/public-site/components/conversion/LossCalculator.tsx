'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

/** Дополнительная конверсия при мгновенном ответе на сайте (абс. %). */
const CHAT_CONVERSION_UPLIFT = 0.018;

function formatNum(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n);
}

function formatRub(n: number) {
  return `${formatNum(n)} ₽`;
}

function SliderField({
  id,
  label,
  hint,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink-900">
          {label}
        </label>
        <span className="text-lg font-bold text-brand-600">{display}</span>
      </div>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
      <div className="relative mt-3">
        <div className="h-2 rounded-full bg-line-200">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="roi-slider absolute inset-0 h-2 w-full cursor-pointer appearance-none bg-transparent"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        />
      </div>
    </div>
  );
}

export function LossCalculator() {
  const [visitors, setVisitors] = useState(5000);
  const [avgCheck, setAvgCheck] = useState(15000);
  const [conversionRate, setConversionRate] = useState(1.2);

  const metrics = useMemo(() => {
    const baseRate = conversionRate / 100;
    const withChatRate = baseRate + CHAT_CONVERSION_UPLIFT;

    const currentClients = Math.round(visitors * baseRate);
    const potentialClients = Math.round(visitors * withChatRate);
    const lostClients = Math.max(potentialClients - currentClients, 0);

    const currentRevenue = currentClients * avgCheck;
    const potentialRevenue = potentialClients * avgCheck;
    const lostRevenue = lostClients * avgCheck;

    const yearlyLoss = lostRevenue * 12;

    return {
      currentClients,
      potentialClients,
      lostClients,
      currentRevenue,
      potentialRevenue,
      lostRevenue,
      yearlyLoss,
    };
  }, [visitors, avgCheck, conversionRate]);

  return (
    <div className="overflow-hidden rounded-3xl border border-line-200 bg-white shadow-2xl">
      <div className="grid lg:grid-cols-[1fr_1.05fr]">
        {/* Controls */}
        <div className="border-b border-line-200 p-6 sm:p-8 lg:border-b-0 lg:border-r">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">
            Калькулятор упущенной выгоды
          </p>
          <h3 className="mt-2 text-xl font-bold text-ink-900 sm:text-2xl">
            Посчитайте на своих цифрах
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">
            Двигайте ползунки — увидите, сколько клиентов и денег сайт теряет прямо сейчас
            без мгновенного ответа.
          </p>

          <div className="mt-8 space-y-7">
            <SliderField
              id="roi-visitors"
              label="Посетителей сайта в месяц"
              min={500}
              max={50000}
              step={500}
              value={visitors}
              display={formatNum(visitors)}
              onChange={setVisitors}
            />
            <SliderField
              id="roi-check"
              label="Средний чек, ₽"
              hint="Средняя сумма сделки или заказа"
              min={3000}
              max={150000}
              step={1000}
              value={avgCheck}
              display={formatRub(avgCheck)}
              onChange={setAvgCheck}
            />
            <SliderField
              id="roi-conversion"
              label="Конверсия сайта сейчас"
              hint="Доля посетителей, которые оставляют заявку или покупают"
              min={0.3}
              max={5}
              step={0.1}
              value={conversionRate}
              display={`${conversionRate.toFixed(1)}%`}
              onChange={setConversionRate}
            />
          </div>
        </div>

        {/* Results */}
        <div className="bg-gradient-to-br from-ink-900 via-ink-900 to-brand-950 p-6 text-white sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Сейчас получаете
              </p>
              <p className="mt-2 text-2xl font-extrabold text-white">
                {formatNum(metrics.currentClients)}
                <span className="ml-1 text-sm font-normal text-slate-400">клиентов</span>
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-200">
                {formatRub(metrics.currentRevenue)}
                <span className="text-sm font-normal text-slate-400"> / мес</span>
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-300">
                С AI-чатом на сайте
              </p>
              <p className="mt-2 text-2xl font-extrabold text-emerald-300">
                {formatNum(metrics.potentialClients)}
                <span className="ml-1 text-sm font-normal text-emerald-400/80">клиентов</span>
              </p>
              <p className="mt-1 text-lg font-semibold text-emerald-200">
                {formatRub(metrics.potentialRevenue)}
                <span className="text-sm font-normal text-emerald-400/80"> / мес</span>
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 px-5 py-6 text-center">
            <p className="text-sm text-red-200">Вы теряете прямо сейчас</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight text-red-300 sm:text-5xl">
              {formatRub(metrics.lostRevenue)}
            </p>
            <p className="mt-2 text-sm text-red-200/80">
              {formatNum(metrics.lostClients)} клиентов в месяц ·{' '}
              {formatRub(metrics.yearlyLoss)} в год
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Оценка при отсутствии мгновенного ответа. С AI-чатом конверсия выше
              примерно на {(CHAT_CONVERSION_UPLIFT * 100).toFixed(1)} п.п.
            </p>
          </div>

          <Link
            href="/register"
            className="mt-6 flex w-full items-center justify-center rounded-xl bg-brand-500 px-6 py-3.5 text-center text-base font-semibold text-white shadow-cta transition hover:bg-brand-600"
          >
            Вернуть эти продажи — начать бесплатно
          </Link>
          <p className="mt-3 text-center text-xs text-slate-500">
            7 дней бесплатно · без банковской карты
          </p>
        </div>
      </div>
    </div>
  );
}
