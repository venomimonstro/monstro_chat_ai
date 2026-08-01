import type { Metadata } from 'next';
import Link from 'next/link';
import { PricingGrid } from '@/components/PricingGrid';
import { fetchPublicTariffs } from '@/lib/tariffs';
import { CheckIcon } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Тарифы',
  description: 'Гибкие тарифы AI-Консультант с 7-дневным пробным периодом. Начните бесплатно.',
};

export default async function PricingPage() {
  const tariffs = await fetchPublicTariffs();

  return (
    <div>
      <section className="hero-gradient border-b border-slate-100 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Простые и прозрачные тарифы
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Выберите подходящий план и начните с бесплатного триала на 7 дней.
            Без скрытых платежей и обязательств.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <PricingGrid tariffs={tariffs} />
        </div>
      </section>

      <section className="bg-slate-50 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold text-slate-900">Все тарифы включают</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              'ИИ-ответы по базе знаний',
              'Сбор лидов и CRM-карточки',
              'amoCRM и Битрикс24',
              'Яндекс.Метрика, GTM, GA4',
              'Аналитика по диалогам',
              'Email-поддержка',
              'SSL и изоляция данных',
              'Ролевая модель доступа',
              'Автоматические обновления',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-card">
                <CheckIcon />
                <span className="text-sm font-medium text-slate-700">{item}</span>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <p className="text-slate-600">
              Нужна индивидуальная настройка или большой объём?{' '}
              <Link href="/register" className="font-medium text-brand-600 hover:underline">
                Свяжитесь с нами
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
