'use client';

import { useState } from 'react';

interface FaqItem {
  question: string;
  answer: string;
}

const faqData: FaqItem[] = [
  {
    question: 'Может ли AI дать неверный ответ?',
    answer:
      'Да, такая вероятность есть. Поэтому перед запуском важно проверить ответы на критичные сценарии и поддерживать материалы в актуальном состоянии. Если данных недостаточно, консультант может предложить передать вопрос менеджеру.',
  },
  {
    question: 'Можно ли проверить ответы до установки?',
    answer:
      'Да. В личном кабинете можно добавить материалы, задать типовые и сложные вопросы и скорректировать знания до публикации виджета на сайте.',
  },
  {
    question: 'AI заменит менеджеров?',
    answer:
      'Нет. Он помогает отвечать на типовые вопросы, уточнять запрос и собирать контекст. Сложные переговоры и решения остаются у вашей команды.',
  },
  {
    question: 'Откуда чат знает информацию о моём бизнесе?',
    answer:
      'Вы добавляете страницы сайта, файлы и собственные инструкции. Знания можно дополнять и обновлять в личном кабинете.',
  },
  {
    question: 'Куда будут приходить заявки?',
    answer:
      'Контакты сохраняются в CRM личного кабинета вместе с историей диалога. Дополнительные каналы доставки и интеграции настраиваются отдельно.',
  },
  {
    question: 'Что произойдёт после семи дней?',
    answer:
      'Во время теста списаний нет. Для продолжения вы отдельно выбираете подходящий платный тариф в личном кабинете.',
  },
];

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl divide-y divide-line-200 rounded-2xl border border-line-200 bg-white px-6">
      {faqData.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={index} className="py-5">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : index)}
              className="flex w-full items-center justify-between text-left"
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${index}`}
              id={`faq-trigger-${index}`}
            >
              <span className="text-base font-medium text-ink-900">{item.question}</span>
              <span
                className={`ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-transform ${
                  isOpen ? 'rotate-180' : ''
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            {isOpen && (
              <p
                id={`faq-panel-${index}`}
                role="region"
                aria-labelledby={`faq-trigger-${index}`}
                className="mt-3 text-sm leading-6 text-ink-700"
              >
                {item.answer}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
