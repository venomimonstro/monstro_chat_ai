import Link from 'next/link';
import type { TariffDto } from '@ai-consultant/shared-types';
import { isUuid } from '@/lib/uuid';

export function PricingTeaser({ tariffs }: { tariffs: TariffDto[] }) {
  const visible = tariffs
    .filter((tariff) => tariff.isActive && tariff.period === 'month')
    .slice(0, 3);

  if (!visible.length) return null;

  return (
    <section id="pricing" className="scroll-mt-20 bg-surface-50 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-eyebrow">После бесплатного теста</p>
          <h2 className="section-title mt-3">Выберите объём, когда увидите продукт в работе</h2>
          <p className="section-subtitle">
            Семь дней без банковской карты. Платный тариф выбирается отдельно.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {visible.map((tariff, index) => {
            const isPopular = index === 1 || (visible.length === 1 && index === 0);
            return (
            <article
              key={tariff.id}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft ${
                isPopular
                  ? 'border-brand-300 ring-2 ring-brand-500/20'
                  : 'border-line-200'
              }`}
            >
              {isPopular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-3 py-0.5 text-xs font-semibold text-white shadow-cta">
                  Популярный
                </span>
              )}
              <h3 className="text-lg font-semibold text-ink-900">{tariff.name}</h3>
              <p className="mt-4 text-3xl font-bold text-ink-900">
                {tariff.price.toLocaleString('ru-RU')} ₽
                <span className="text-sm font-normal text-ink-500"> / мес</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3 text-sm text-ink-700">
                <li>✓ {tariff.messageLimit.toLocaleString('ru-RU')} сообщений</li>
                <li>✓ {tariff.sourceLimit} источников</li>
                <li>✓ {tariff.kbLimitMb} МБ базы знаний</li>
              </ul>
              <Link
                href={
                  isUuid(tariff.id)
                    ? `/register?tariffId=${encodeURIComponent(tariff.id)}&tariffName=${encodeURIComponent(tariff.name)}`
                    : `/register?tariffName=${encodeURIComponent(tariff.name)}`
                }
                className="btn-primary mt-7 text-center"
              >
                Начать 7-дневный тест
              </Link>
            </article>
            );
          })}
        </div>

        <p className="mt-8 text-center">
          <Link href="/pricing" className="font-medium text-brand-700 hover:underline">
            Сравнить тарифы подробно →
          </Link>
        </p>
      </div>
    </section>
  );
}
