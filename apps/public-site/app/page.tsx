import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { FeatureCard } from '@/components/FeatureCard';
import { FaqAccordion } from '@/components/FaqAccordion';
import { ChatMockup } from '@/components/ChatMockup';
import { LiveDemoSection } from '@/components/conversion/LiveDemoSection';
import { PricingTeaser } from '@/components/conversion/PricingTeaser';
import { BeforeAfterSection } from '@/components/conversion/BeforeAfterSection';
import { RoiCalculatorSection } from '@/components/conversion/RoiCalculatorSection';
import { ObjectionsSection } from '@/components/conversion/ObjectionsSection';
import { TestimonialsSection } from '@/components/conversion/TestimonialsSection';
import { SocialProofBar } from '@/components/conversion/SocialProofBar';
import { siteConfig } from '@/lib/site';
import { fetchPublicTariffs } from '@/lib/tariffs';
import { faqData } from '@/lib/faq';
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
    text: 'Посетитель готов уточнить цену или условия, но ответ менеджера будет только утром — к этому моменту он уже купил у конкурента.',
  },
  {
    title: 'Ответ спрятан на странице',
    text: 'Информация есть на сайте, но посетителю приходится искать её самостоятельно. 7 из 10 уходят, не дождавшись.',
  },
  {
    title: 'Команда повторяет одно и то же',
    text: 'Время менеджеров уходит на цены, сроки, доставку — вместо работы с горячими клиентами, готовыми платить.',
  },
  {
    title: 'Контакт приходит без контекста',
    text: 'Менеджеру приходится заново выяснять, что интересовало посетителя. Клиент теряет терпение и уходит.',
  },
];

const useCases = [
  ['Запись и консультации', 'Услуги, клиники, салоны — чат записывает и собирает контакт 24/7'],
  ['Подбор товара', 'Интернет-магазины и каталоги — AI помогает выбрать и оформить заказ'],
  ['Квалификация запроса', 'B2B и недвижимость — чат уточняет бюджет и сроки до передачи менеджеру'],
  ['Цены и условия', 'Онлайн-обучение, доставка — мгновенные ответы на типовые вопросы'],
];

const faqItems = [
  {
  question: 'Сколько стоит подключение?',
  answer: 'Семь дней бесплатно, без банковской карты. Платный тариф выбираете после теста.',
  },
  {
  question: 'Как быстро можно запустить?',
  answer: 'Подключение занимает около 15 минут: добавьте знания, проверьте ответы и вставьте код на сайт.',
  },
  {
  question: 'Заменит ли чат менеджеров?',
  answer: 'Нет. AI берёт рутину и мгновенные ответы, менеджеры работают только с готовыми клиентами.',
  },
  {
  question: 'Что если ответа нет в базе знаний?',
  answer: 'Чат честно сообщает об этом и предлагает передать вопрос менеджеру вместе с контекстом диалога.',
  },
  {
  question: 'Можно ли протестировать до оплаты?',
  answer: 'Да. Создайте консультанта, проверьте ответы на своих материалах и только потом решайте об оплате.',
  },
  {
  question: 'Какие интеграции есть?',
  answer: 'Экспорт лидов в amoCRM и Bitrix24, аналитика Яндекс.Метрики и Google Analytics.',
  },
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
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqData.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        }}
      />

      {/* Hero */}
      <section className="hero-light">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <span className="badge">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                AI-консультант, который продаёт 24/7
              </span>
              <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-ink-900 md:text-5xl lg:text-[3.25rem]">
                Превращайте посетителей в клиентов,{' '}
                <span className="gradient-text">пока менеджеры спят</span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-ink-700">
                Monstro Chat AI мгновенно отвечает по материалам вашей компании,
                уточняет запрос и передаёт контакт менеджеру вместе с историей диалога.
                Без потерянных обращений и пустых ночных визитов.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="btn-primary text-center">
                  Попробовать 7 дней бесплатно
                </Link>
                <a href="#calculator" className="btn-secondary text-center">
                  Посчитать упущенную выгоду
                </a>
              </div>
              <p className="mt-3 text-sm text-ink-500">
                Без банковской карты · Подключение за 15 минут · Отмена в любой момент
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

      <SocialProofBar />

      <LiveDemoSection />

      {/* Pain points */}
      <section className="bg-surface-50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-eyebrow">Знакомая ситуация?</p>
            <h2 className="section-title mt-3">Где ваш сайт теряет готовых клиентов</h2>
            <p className="section-subtitle">
              Каждый из этих сценариев — реальные деньги, которые уходят к конкурентам
            </p>
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

      {/* Before / After */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-eyebrow">До и после</p>
            <h2 className="section-title mt-3">Что меняется после запуска чата</h2>
          </div>
          <div className="mt-12">
            <BeforeAfterSection />
          </div>
        </div>
      </section>

      <RoiCalculatorSection />

      {/* Journey */}
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
              ['01', 'Посетитель получает ответ', 'AI ищет информацию в подключённых материалах — мгновенно, без ожидания.'],
              ['02', 'Запрос уточняется', 'Диалог помогает понять задачу и интерес посетителя.'],
              ['03', 'Контакт передаётся', 'Менеджер получает обращение вместе с полным разговором.'],
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
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex justify-center rounded-xl bg-brand-500 px-6 py-3 font-semibold hover:bg-brand-600">
                Проверить на своих материалах
              </Link>
              <a href="#demo" className="inline-flex justify-center rounded-xl border border-white/20 px-6 py-3 font-medium transition hover:bg-white/10">
                Открыть демо
              </a>
            </div>
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

      <section id="features" className="scroll-mt-20 bg-white py-20 md:py-28">
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
              <article key={title} className="card card-hover">
                <h3 className="font-semibold text-ink-900">{title}</h3>
                <p className="mt-2 text-sm text-ink-700">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-eyebrow">Результаты клиентов</p>
            <h2 className="section-title mt-3">Что говорят после запуска</h2>
          </div>
          <div className="mt-12">
            <TestimonialsSection />
          </div>
        </div>
      </section>

      <PricingTeaser tariffs={tariffs} />

      {/* Objections */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-eyebrow">Сомнения?</p>
            <h2 className="section-title mt-3">Отвечаем на главные вопросы</h2>
          </div>
          <div className="mt-12">
            <ObjectionsSection />
          </div>
        </div>
      </section>

      {/* Risk-free CTA */}
      <section className="bg-surface-50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-brand-50 px-7 py-12 text-center shadow-soft md:px-16">
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
              <a href="#calculator" className="btn-secondary">Посчитать выгоду</a>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-20 bg-white py-20 md:py-28">
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
