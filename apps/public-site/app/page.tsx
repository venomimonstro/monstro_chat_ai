import Link from 'next/link';
import { WidgetDemo } from '@/components/WidgetDemo';
import { JsonLd } from '@/components/JsonLd';
import { FeatureCard } from '@/components/FeatureCard';
import { FaqAccordion } from '@/components/FaqAccordion';
import { fetchDemoWidget } from '@/lib/tariffs';
import { siteConfig } from '@/lib/site';
import { ChatIcon, BrainIcon, CrmIcon, ChartIcon, ShieldIcon, SetupIcon } from '@/components/icons';

export default async function HomePage() {
  const demo = await fetchDemoWidget();

  return (
    <div>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: siteConfig.name,
          description: siteConfig.description,
          brand: { '@type': 'Brand', name: siteConfig.name },
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'RUB',
            lowPrice: '2990',
            highPrice: '19990',
          },
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.8',
            reviewCount: '120',
          },
        }}
      />

      {/* Hero */}
      <section className="hero-gradient relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                7 дней бесплатного триала
              </span>
              <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl lg:text-6xl">
                Умный чат, который{' '}
                <span className="gradient-text">продаёт за вас</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                AI-Консультант отвечает посетителям 24/7, собирает контакты и передаёт
                готовые лиды в amoCRM или Битрикс24 — пока вы занимаетесь бизнесом.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/register" className="btn-primary">
                  Начать бесплатно
                </Link>
                <Link href="/pricing" className="btn-secondary">
                  Смотреть тарифы
                </Link>
              </div>
              <div className="mt-8 flex items-center gap-4 text-sm text-slate-500">
                <div className="flex -space-x-2">
                  {['bg-blue-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400'].map((c, i) => (
                    <div key={i} className={`h-8 w-8 rounded-full border-2 border-white ${c}`} />
                  ))}
                </div>
                <p>Уже используют 200+ компаний</p>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft">
                <WidgetDemo
                  widgetKey={demo.demoWidgetKey}
                  apiUrl={demo.apiUrl}
                  widgetUrl={demo.widgetUrl}
                  welcomeTitle={demo.welcomeTitle}
                  welcomeText={demo.welcomeText}
                  showEmbed={false}
                />
              </div>
              <div className="absolute -right-6 -top-6 hidden h-24 w-24 rounded-full bg-brand-200/50 blur-2xl md:block" />
              <div className="absolute -bottom-6 -left-6 hidden h-24 w-24 rounded-full bg-brand-300/30 blur-2xl md:block" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats / trust bar */}
      <section className="border-y border-slate-100 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-4">
          {[
            { value: '24/7', label: 'Режим работы' },
            { value: '5 мин', label: 'До запуска виджета' },
            { value: '35%', label: 'Рост конверсии в среднем' },
            { value: '2 CRM', label: 'Интеграции из коробки' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-brand-600">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="section-title">Всё, что нужно для общения с клиентами</h2>
            <p className="section-subtitle">
              Без сложной настройки и найма дополнительных менеджеров
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            <FeatureCard
              icon={<ChatIcon />}
              title="Отвечает вместо менеджера"
              description="Агент понимает вопросы посетителей, отвечает на основе вашей базы знаний и не путается в деталях."
            />
            <FeatureCard
              icon={<BrainIcon />}
              title="Обучается на ваших материалах"
              description="Загрузите сайт, FAQ и документы. RAG-технология гарантирует точные ответы без домысливания."
            />
            <FeatureCard
              icon={<CrmIcon />}
              title="Собирает лиды в CRM"
              description="Автоматически извлекает имя, телефон и email, создаёт лид и передаёт в amoCRM или Битрикс24."
            />
            <FeatureCard
              icon={<ChartIcon />}
              title="Аналитика и прозрачность"
              description="Смотрите диалоги, конверсию, популярные вопросы и эффективность источников в одном окне."
            />
            <FeatureCard
              icon={<ShieldIcon />}
              title="Безопасность и 152-ФЗ"
              description="Изоляция данных по клиентам, HTTPS, ролевая модель и готовые документы для compliance."
            />
            <FeatureCard
              icon={<SetupIcon />}
              title="Установка за 5 минут"
              description="Скопируйте один JS-скрипт на сайт — виджет сразу готов к работе."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="section-title">Как это работает</h2>
            <p className="section-subtitle">От регистрации до первого лида — три простых шага</p>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Создайте источник',
                text: 'Укажите название сайта и получите уникальный код виджета.',
              },
              {
                step: '02',
                title: 'Обучите агента',
                text: 'Добавьте URL сайта или загрузите документы — база знаний создаётся автоматически.',
              },
              {
                step: '03',
                title: 'Получайте лиды',
                text: 'Посетители задают вопросы, агент отвечает и сохраняет контакты в CRM.',
              },
            ].map((item) => (
              <div key={item.step} className="rounded-2xl bg-white p-8 shadow-card">
                <span className="text-3xl font-bold text-brand-200">{item.step}</span>
                <h3 className="mt-4 text-xl font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo / CTA */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 p-8 text-white shadow-soft md:p-14">
            <div className="grid items-center gap-10 md:grid-cols-2">
              <div>
                <h2 className="text-3xl font-bold md:text-4xl">Попробуйте бесплатно 7 дней</h2>
                <p className="mt-4 text-brand-100">
                  Не нужна карта и длительная настройка. Зарегистрируйтесь и запустите
                  виджет на своём сайте сегодня.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link
                    href="/register"
                    className="rounded-full bg-white px-6 py-3 font-medium text-brand-700 shadow-lg transition hover:bg-brand-50"
                  >
                    Создать аккаунт
                  </Link>
                  <Link
                    href="/pricing"
                    className="rounded-full border border-white/30 px-6 py-3 font-medium text-white transition hover:bg-white/10"
                  >
                    Тарифы
                  </Link>
                </div>
              </div>
              <div>
                <div className="rounded-2xl bg-white/10 p-6 backdrop-blur">
                  <WidgetDemo
                    widgetKey={demo.demoWidgetKey}
                    apiUrl={demo.apiUrl}
                    widgetUrl={demo.widgetUrl}
                    welcomeTitle={demo.welcomeTitle}
                    welcomeText={demo.welcomeText}
                    showEmbed={false}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="section-title">Частые вопросы</h2>
            <p className="section-subtitle">Ответы на самые популярные вопросы о сервисе</p>
          </div>
          <div className="mt-12">
            <FaqAccordion />
          </div>
        </div>
      </section>
    </div>
  );
}
