import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { FeatureCard } from '@/components/FeatureCard';
import { FaqAccordion } from '@/components/FaqAccordion';
import { ChatMockup } from '@/components/ChatMockup';
import { LossCalculator } from '@/components/conversion/LossCalculator';
import { BeforeAfterSection } from '@/components/conversion/BeforeAfterSection';
import { TestimonialsSection } from '@/components/conversion/TestimonialsSection';
import { ObjectionsSection } from '@/components/conversion/ObjectionsSection';
import { siteConfig } from '@/lib/site';
import {
  ChatIcon,
  BrainIcon,
  CrmIcon,
  ChartIcon,
  ShieldIcon,
  SetupIcon,
} from '@/components/icons';

const pains = [
  {
    title: 'Клиент пришёл и ушёл',
    text: 'Человек зашёл на сайт, не нашёл ответ за 10 секунд и закрыл вкладку. Вы заплатили за визит рекламой, но не получили ни заявки, ни контакта.',
  },
  {
    title: 'Вопросы есть — ответить некому',
    text: 'У посетителя созрел вопрос вечером, в выходной или ночью. Он не станет ждать до утра — просто уйдёт и решит вопрос в другом месте.',
  },
  {
    title: 'Деньги утекают незаметно',
    text: 'Вы не видите тех, кого потеряли, поэтому кажется, что всё в порядке. А каждый день без чата — десятки упущенных клиентов и недополученная выручка.',
  },
];

const audiences = [
  { emoji: '🏥', title: 'Клиники и медцентры', text: 'Запись и ответы на вопросы — даже ночью' },
  { emoji: '🔧', title: 'Автосервисы и салоны', text: 'Заявки на ремонт и тест-драйв без звонков' },
  { emoji: '🏠', title: 'Недвижимость', text: 'Консультации по объектам и сбор контактов' },
  { emoji: '💄', title: 'Салоны красоты и SPA', text: 'Запись на процедуры без ожидания на линии' },
  { emoji: '⚖️', title: 'Юристы и услуги', text: 'Квалификация клиента и назначение консультации' },
  { emoji: '🛒', title: 'Интернет-магазины', text: 'Помощь с выбором и доведение до покупки' },
];

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
        }}
      />

      {/* Hero */}
      <section className="hero-light">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <span className="badge">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                +37% заявок в среднем за первый месяц
              </span>
              <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-ink-900 md:text-5xl lg:text-[3.25rem]">
                Превратите посетителей сайта в{' '}
                <span className="gradient-text">покупателей 24/7</span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-ink-700">
                Monstro Chat AI — умный чат, который отвечает как ваш лучший продавец,
                снимает возражения и собирает заявки круглосуточно. Пока вы спите —
                он продаёт.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="btn-primary">
                  Начать бесплатно — 7 дней
                </Link>
                <a href="#calculator" className="btn-secondary">
                  Посчитать упущенную выручку
                </a>
              </div>
              <ul className="mt-10 grid gap-3 sm:grid-cols-2">
                {[
                  'Бесплатные лиды 24/7 — чат работает, пока вы спите',
                  'Настройка за 5 минут — без программистов',
                  'Отвечает как лучший менеджер — мгновенно и по делу',
                  'Ни один посетитель не уходит молча',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-ink-700">
                    <span className="mt-0.5 font-bold text-brand-500" aria-hidden>
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

      {/* Stats */}
      <section className="border-y border-line-200 bg-surface-50">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-2 md:grid-cols-4">
          {[
            { value: '+37%', label: 'рост заявок с сайта' },
            { value: '24/7', label: 'чат приводит клиентов' },
            { value: '5 мин', label: 'на запуск без кода' },
            { value: '<3 сек', label: 'среднее время ответа' },
          ].map((stat) => (
            <div key={stat.label} className="text-center md:text-left">
              <p className="text-2xl font-bold text-brand-600 md:text-3xl">{stat.value}</p>
              <p className="mt-1 text-sm text-ink-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Loss calculator */}
      <section id="calculator" className="scroll-mt-20 bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-eyebrow">Калькулятор потерь</p>
            <h2 className="section-title mt-3">
              Сколько денег вы теряете без чата на сайте?
            </h2>
            <p className="section-subtitle">
              Подставьте свои цифры — увидите, сколько выручки уходит к конкурентам
            </p>
          </div>
          <div className="mt-12">
            <LossCalculator />
          </div>
        </div>
      </section>

      {/* Pain */}
      <section className="bg-surface-50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="section-eyebrow">Проблема</p>
            <h2 className="section-title mt-3">
              Пока на сайте нет чата — вы платите за трафик и отпускаете его
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {pains.map((pain) => (
              <div key={pain.title} className="card">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-lg font-bold text-brand-600">
                  !
                </div>
                <h3 className="text-lg font-semibold text-ink-900">{pain.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-700">{pain.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Before / After */}
      <section className="bg-surface-50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-eyebrow">До и после</p>
            <h2 className="section-title mt-3">
              Что меняется, когда на сайте появляется AI-чат
            </h2>
          </div>
          <div className="mt-12">
            <BeforeAfterSection />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="section-eyebrow">Как это работает</p>
            <h2 className="section-title mt-3">Три шага — и лиды идут сами</h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Подключаете за 5 минут',
                text: 'Вставляете одну строчку кода на сайт. Никаких разработчиков и технической возни.',
              },
              {
                step: '02',
                title: 'AI изучает ваш бизнес',
                text: 'Monstro Chat AI считывает услуги, цены и условия — и учится отвечать как ваш лучший менеджер.',
              },
              {
                step: '03',
                title: 'Получаете лиды на автопилоте',
                text: 'Чат встречает каждого посетителя, снимает возражения и собирает контакты в CRM.',
              },
            ].map((item) => (
              <div key={item.step} className="card relative overflow-hidden">
                <span className="text-5xl font-extrabold text-brand-100">{item.step}</span>
                <h3 className="mt-2 text-xl font-semibold text-ink-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-700">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Unique value */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-eyebrow">Почему Monstro Chat AI</p>
            <h2 className="section-title mt-3">
              Живой продавец на базе AI — не безликий бот
            </h2>
            <p className="section-subtitle">
              Единственное решение, которое превращает молчаливый сайт в круглосуточный
              источник заявок
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<ChatIcon />}
              title="Работает 24/7 без перерывов"
              description="Приводит клиентов ночью, в выходные и праздники — когда вы недоступны."
            />
            <FeatureCard
              icon={<BrainIcon />}
              title="Отвечает как человек"
              description="Понимает смысл вопроса и общается естественно, без заученных шаблонов."
            />
            <FeatureCard
              icon={<SetupIcon />}
              title="Настройка за 5 минут"
              description="Запускается в день подключения — уже сегодня чат начнёт приносить заявки."
            />
            <FeatureCard
              icon={<ShieldIcon />}
              title="Знает ваш бизнес"
              description="Обучается на услугах, ценах и условиях — говорит языком вашей компании."
            />
            <FeatureCard
              icon={<ChartIcon />}
              title="Не упускает посетителей"
              description="Первым начинает диалог и мягко ведёт человека к заявке."
            />
            <FeatureCard
              icon={<CrmIcon />}
              title="Заявки сразу к вам"
              description="Горячие лиды в CRM, Telegram или на почту — ничего не теряется."
            />
          </div>
        </div>
      </section>

      {/* Who is it for */}
      <section id="for-whom" className="scroll-mt-20 bg-surface-50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="section-eyebrow">Для кого</p>
            <h2 className="section-title mt-3">
              Идеально, если клиенты приходят с сайта — а чата пока нет
            </h2>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {audiences.map((item) => (
              <div key={item.title} className="card flex gap-4">
                <span className="text-2xl" aria-hidden>
                  {item.emoji}
                </span>
                <div>
                  <h3 className="font-semibold text-ink-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-ink-700">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="section-eyebrow">Результаты клиентов</p>
            <h2 className="section-title mt-3">Владельцы бизнеса уже увеличили продажи</h2>
          </div>
          <div className="mt-12">
            <TestimonialsSection />
          </div>
        </div>
      </section>

      {/* Objections */}
      <section className="bg-surface-50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-eyebrow">Сомнения?</p>
            <h2 className="section-title mt-3">Отвечаем на главные вопросы перед стартом</h2>
          </div>
          <div className="mt-12">
            <ObjectionsSection />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 px-8 py-14 text-center text-white shadow-cta md:px-16">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" aria-hidden />
            <div className="relative">
              <h2 className="text-3xl font-bold md:text-4xl">
                Каждый день без чата — это клиенты, которые уходят молча
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-brand-100">
                Подключите Monstro Chat AI за 5 минут и позвольте AI-менеджеру приводить
                заявки уже сегодня — круглосуточно и на автопилоте.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  href="/register"
                  className="rounded-xl bg-white px-8 py-3.5 font-semibold text-brand-700 shadow-lg transition hover:bg-brand-50"
                >
                  Начать бесплатно — 7 дней
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-xl border border-white/30 px-8 py-3.5 font-medium transition hover:bg-white/10"
                >
                  Смотреть тарифы
                </Link>
              </div>
              <p className="mt-6 text-sm text-brand-100">
                Попробуйте чат прямо сейчас — красная кнопка в правом нижнем углу
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-surface-50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="section-title">Частые вопросы</h2>
          </div>
          <div className="mt-12">
            <FaqAccordion />
          </div>
        </div>
      </section>
    </div>
  );
}
