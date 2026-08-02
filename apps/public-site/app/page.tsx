import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { FeatureCard } from '@/components/FeatureCard';
import { FaqAccordion } from '@/components/FaqAccordion';
import { ChatMockup } from '@/components/ChatMockup';
import { LiveDemoSection } from '@/components/conversion/LiveDemoSection';
import { PricingTeaser } from '@/components/conversion/PricingTeaser';
import { siteConfig } from '@/lib/site';
import { fetchPublicTariffs } from '@/lib/tariffs';
import {
  ChatIcon,
  BrainIcon,
  CrmIcon,
  ChartIcon,
  ShieldIcon,
  SetupIcon,
} from '@/components/icons';

const situations = [
  {
    title: 'Вопрос возник после рабочего дня',
    text: 'Посетитель готов уточнить цену или условия, но ответ менеджера будет только утром.',
  },
  {
    title: 'Ответ спрятан на странице',
    text: 'Информация есть на сайте, но посетителю приходится искать её самостоятельно.',
  },
  {
    title: 'Команда повторяет одно и то же',
    text: 'Время менеджеров уходит на цены, сроки, доставку, запись и другие типовые вопросы.',
  },
  {
    title: 'Контакт приходит без контекста',
    text: 'Менеджеру приходится заново выяснять, что интересовало посетителя и что он уже узнал.',
  },
];

const useCases = [
  ['Запись и консультации', 'Услуги, клиники, салоны и сервисные компании'],
  ['Подбор товара', 'Интернет-магазины, каталоги и производители'],
  ['Квалификация запроса', 'Недвижимость, B2B и профессиональные услуги'],
  ['Цены и условия', 'Онлайн-обучение, доставка и подписные сервисы'],
];

export default async function HomePage() {
  const tariffs = await fetchPublicTariffs();

  return (
    <div>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: siteConfig.name,
          description: siteConfig.description,
          brand: { '@type': 'Brand', name: siteConfig.name },
        }}
      />

      <section className="hero-light">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <span className="badge">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                AI-консультант для вашего сайта
              </span>
              <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-ink-900 md:text-5xl lg:text-[3.25rem]">
                Отвечайте посетителям и собирайте обращения,{' '}
                <span className="gradient-text">даже когда менеджеры офлайн</span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-ink-700">
                Monstro Chat AI отвечает по материалам вашей компании, уточняет запрос
                и передаёт контакт менеджеру вместе с историей диалога.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="btn-primary text-center">
                  Попробовать 7 дней бесплатно
                </Link>
                <a href="#demo" className="btn-secondary text-center">
                  Открыть демо-диалог
                </a>
              </div>
              <p className="mt-3 text-sm text-ink-500">
                Без банковской карты · Решение об оплате — после теста
              </p>
              <ul className="mt-9 grid gap-3 sm:grid-cols-2">
                {[
                  'Ответы по вашей базе знаний',
                  'Работа с обращениями 24/7',
                  'Контакт вместе с контекстом',
                  'Проверка ответов до запуска',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-ink-700">
                    <span className="font-bold text-brand-500" aria-hidden>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <ChatMockup />
          </div>
        </div>
      </section>

      <section className="border-y border-line-200 bg-surface-50">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:grid-cols-3">
          {[
            ['Знания под контролем', 'Сайт, файлы и собственные инструкции'],
            ['Обращение не теряется', 'Контакт сохраняется с историей диалога'],
            ['Безопасный старт', 'Сначала проверка, затем публикация'],
          ].map(([title, text]) => (
            <div key={title} className="flex gap-3">
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                ✓
              </span>
              <div>
                <p className="font-semibold text-ink-900">{title}</p>
                <p className="mt-1 text-sm text-ink-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <LiveDemoSection />

      <section className="bg-surface-50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-eyebrow">Знакомая ситуация?</p>
            <h2 className="section-title mt-3">Где сайт теряет готовые обращения</h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {situations.map((item, index) => (
              <article key={item.title} className="card flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-bold text-brand-700">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-ink-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-700">{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-eyebrow">Путь к обращению</p>
            <h2 className="section-title mt-3">
              Не «бот ради бота», а понятный процесс для бизнеса
            </h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['01', 'Посетитель получает ответ', 'AI ищет информацию в подключённых материалах.'],
              ['02', 'Запрос уточняется', 'Диалог помогает понять задачу и интерес посетителя.'],
              ['03', 'Контакт передаётся', 'Менеджер получает обращение вместе с разговором.'],
              ['04', 'Диалоги улучшают сайт', 'Вы видите, каких ответов не хватает клиентам.'],
            ].map(([step, title, text]) => (
              <article key={step} className="card">
                <span className="text-3xl font-extrabold text-brand-100">{step}</span>
                <h3 className="mt-3 font-semibold text-ink-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-700">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-20 bg-ink-900 py-20 text-white md:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
              Контроль знаний
            </p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              Вы определяете, что знает консультант
            </h2>
            <p className="mt-5 leading-relaxed text-slate-300">
              Добавьте страницы сайта, документы и собственные инструкции. Проверьте
              типовые и сложные вопросы, исправьте материалы — и только потом покажите
              чат посетителям.
            </p>
            <Link href="/register" className="mt-7 inline-flex rounded-xl bg-brand-500 px-6 py-3 font-semibold hover:bg-brand-600">
              Проверить на своих материалах
            </Link>
          </div>
          <div className="space-y-3">
            {[
              ['1', 'Добавьте источники', 'Страницы сайта, PDF, DOCX, TXT, CSV или ручные знания.'],
              ['2', 'Проверьте ответы', 'Задайте вопросы и скорректируйте критичные формулировки.'],
              ['3', 'Установите виджет', 'Добавьте фрагмент кода самостоятельно или передайте разработчику.'],
            ].map(([step, title, text]) => (
              <div key={step} className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 font-bold">
                  {step}
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-slate-300">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="section-eyebrow">Возможности</p>
            <h2 className="section-title mt-3">Всё необходимое для обработки обращений</h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard icon={<BrainIcon />} title="База знаний" description="Ответы строятся на материалах и инструкциях вашей компании." />
            <FeatureCard icon={<ChatIcon />} title="Диалог 24/7" description="Посетитель может получить помощь в удобное ему время." />
            <FeatureCard icon={<CrmIcon />} title="Сбор контактов" description="Телефон, имя и email сохраняются вместе с контекстом." />
            <FeatureCard icon={<ChartIcon />} title="История и аналитика" description="Смотрите вопросы, диалоги и причины обращений." />
            <FeatureCard icon={<ShieldIcon />} title="Контроль ответов" description="Тестируйте агента до публикации и обновляйте знания." />
            <FeatureCard icon={<SetupIcon />} title="Понятное подключение" description="Получите готовый код и инструкции для установки." />
          </div>
        </div>
      </section>

      <section className="bg-surface-50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="section-eyebrow">Сценарии</p>
            <h2 className="section-title mt-3">Какие обращения можно автоматизировать</h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {useCases.map(([title, text]) => (
              <article key={title} className="card">
                <h3 className="font-semibold text-ink-900">{title}</h3>
                <p className="mt-2 text-sm text-ink-700">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PricingTeaser tariffs={tariffs} />

      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="rounded-3xl border border-brand-100 bg-brand-50 px-7 py-12 text-center md:px-16">
            <p className="section-eyebrow">Без риска</p>
            <h2 className="mt-3 text-3xl font-bold text-ink-900 md:text-4xl">
              Сначала проверьте — потом решайте
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-ink-700">
              Создайте консультанта, проверьте ответы и протестируйте его на сайте.
              Карта при регистрации не нужна. Платный тариф выбирается отдельно.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/register" className="btn-primary">Начать бесплатный тест</Link>
              <a href="#demo" className="btn-secondary">Открыть демо</a>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-surface-50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="section-eyebrow">Перед стартом</p>
            <h2 className="section-title mt-3">Частые вопросы</h2>
          </div>
          <div className="mt-12"><FaqAccordion /></div>
        </div>
      </section>
    </div>
  );
}
