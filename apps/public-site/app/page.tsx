import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { FeatureCard } from '@/components/FeatureCard';
import { FaqAccordion } from '@/components/FaqAccordion';
import { ChatMockup } from '@/components/ChatMockup';
import { PricingComparison } from '@/components/PricingComparison';
import { siteConfig } from '@/lib/site';
import {
  ChatIcon,
  BrainIcon,
  CrmIcon,
  ChartIcon,
  ShieldIcon,
  SetupIcon,
} from '@/components/icons';

export default function HomePage() {
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
            ratingValue: '4.9',
            reviewCount: '200',
          },
        }}
      />

      {/* Hero */}
      <section className="hero-dark relative overflow-hidden">
        <div className="hero-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <span className="badge-glow inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-4 py-1.5 text-xs font-medium text-brand-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                7 дней бесплатно · без карты
              </span>
              <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-[3.25rem]">
                AI-продавец на сайте,{' '}
                <span className="gradient-text-light">который не съедает бюджет</span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-slate-300">
                Отвечает посетителям 24/7, собирает лиды в CRM — а вы платите{' '}
                <strong className="font-semibold text-white">за сообщения</strong>, а не за
                каждую заявку как у конкурентов.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="btn-primary">
                  Запустить за 5 минут
                </Link>
                <a href="#compare" className="btn-ghost">
                  Почему мы дешевле →
                </a>
              </div>
              <ul className="mt-10 grid gap-3 sm:grid-cols-2">
                {[
                  'В 10–50× дешевле оплаты за лиды',
                  'Запуск за 5 минут — один скрипт',
                  'amoCRM и Битрикс24 из коробки',
                  '152-ФЗ, изоляция данных',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-400">
                    <span className="mt-0.5 text-brand-400" aria-hidden>
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <ChatMockup />
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 md:grid-cols-4">
          {[
            { value: '24/7', label: 'Без выходных и праздников' },
            { value: '5 мин', label: 'До первого ответа клиенту' },
            { value: '×10', label: 'Дешевле модели «за лид»' },
            { value: '2 CRM', label: 'Интеграции без разработки' },
          ].map((stat) => (
            <div key={stat.label} className="text-center md:text-left">
              <p className="text-2xl font-bold text-brand-600 md:text-3xl">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison — key differentiator */}
      <section id="compare" className="scroll-mt-20 bg-slate-50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
              Ваше преимущество
            </p>
            <h2 className="section-title mt-3">
              Платите за диалог, а не за каждый лид
            </h2>
            <p className="section-subtitle">
              Конкуренты берут деньги за заявку — даже если клиент передумал. У нас
              прозрачная оплата за сообщения и токены: расходы под контролем, масштаб
              без сюрпризов.
            </p>
          </div>
          <div className="mt-12">
            <PricingComparison />
          </div>
          <p className="mt-6 text-center text-sm text-slate-500">
            Попробуйте чат прямо сейчас — синяя кнопка в правом нижнем углу страницы
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="section-title">Всё для продаж на автопилоте</h2>
            <p className="section-subtitle">
              Как у лидеров рынка — но с честной моделью оплаты и полным контролем
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<ChatIcon />}
              title="Мгновенные ответы 24/7"
              description="AI отвечает за секунды, пока менеджеры спят. Ни один посетитель не уйдёт без ответа."
            />
            <FeatureCard
              icon={<BrainIcon />}
              title="Знает ваш бизнес"
              description="Обучение на сайте, FAQ и документах. RAG исключает выдуманные ответы."
            />
            <FeatureCard
              icon={<CrmIcon />}
              title="Лиды в CRM автоматически"
              description="Имя, телефон, email — сразу в amoCRM или Битрикс24 с контекстом диалога."
            />
            <FeatureCard
              icon={<ChartIcon />}
              title="Аналитика и ROI"
              description="Диалоги, конверсия, расход токенов — видите, сколько стоит каждый канал."
            />
            <FeatureCard
              icon={<ShieldIcon />}
              title="152-ФЗ и безопасность"
              description="Изоляция данных, HTTPS, согласие на обработку ПД, ролевой доступ."
            />
            <FeatureCard
              icon={<SetupIcon />}
              title="Один скрипт — готово"
              description="Вставьте embed-код на сайт. Виджет лёгкий и не тормозит загрузку страницы."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-900 py-20 text-white md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Три шага до первых лидов
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              Быстрее, чем демо у конкурентов — без созвонов и ожидания
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Регистрация и источник',
                text: 'Создайте аккаунт, добавьте сайт — получите код виджета.',
              },
              {
                step: '02',
                title: 'Обучите агента',
                text: 'Укажите URL или загрузите материалы. AI готов за 5 минут.',
              },
              {
                step: '03',
                title: 'Лиды в CRM',
                text: 'Посетители пишут в чат — вы получаете тёплые контакты с историей.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 backdrop-blur"
              >
                <span className="text-4xl font-bold text-brand-400/60">{item.step}</span>
                <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link href="/register" className="btn-primary">
              Начать бесплатный триал
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-600 to-brand-800 px-8 py-14 text-center text-white shadow-soft md:px-16">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-brand-400/20 blur-3xl" aria-hidden />
            <div className="relative">
              <h2 className="text-3xl font-bold md:text-4xl">
                Готовы обойти конкурентов по цене и скорости?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-brand-100">
                7 дней бесплатно. Платите только за реальные сообщения AI — не за
                «воздушные» лиды.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  href="/register"
                  className="rounded-full bg-white px-8 py-3.5 font-semibold text-brand-700 shadow-lg transition hover:bg-brand-50"
                >
                  Создать аккаунт
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-full border border-white/30 px-8 py-3.5 font-medium transition hover:bg-white/10"
                >
                  Тарифы от 2 990 ₽
                </Link>
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
            <p className="section-subtitle">Всё, что спрашивают перед подключением</p>
          </div>
          <div className="mt-12">
            <FaqAccordion />
          </div>
        </div>
      </section>
    </div>
  );
}
