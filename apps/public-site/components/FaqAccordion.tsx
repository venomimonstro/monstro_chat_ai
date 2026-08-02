'use client';

import { useState } from 'react';

interface FaqItem {
  question: string;
  answer: string;
}

const faqData: FaqItem[] = [
  {
    question: 'Чем вы отличаетесь от Parasigma, B24U и других?',
    answer:
      'У конкурентов часто оплата за каждый лид — даже если клиент не купил. У нас прозрачная модель: вы платите за сообщения и токены AI. Это в разы дешевле при том же трафике, а расходы легко прогнозировать в личном кабинете.',
  },
  {
    question: 'Сколько времени занимает запуск виджета?',
    answer:
      'Создание источника и вставка одного JS-скрипта занимает около 5 минут. Обучение агента на вашем сайте происходит автоматически.',
  },
  {
    question: 'Нужно ли платить сразу?',
    answer:
      'Нет. При регистрации вы получаете 7 дней бесплатного триала без привязки карты.',
  },
  {
    question: 'Какие интеграции поддерживаются?',
    answer:
      'amoCRM и Битрикс24 с двусторонней синхронизацией статусов, а также Яндекс.Метрика, GTM и Google Analytics 4.',
  },
  {
    question: 'Можно ли обучить агента на своих документах?',
    answer:
      'Да. Загрузите сайт, FAQ или PDF — агент будет отвечать строго по вашей базе знаний с помощью RAG.',
  },
  {
    question: 'Безопасны ли данные моих клиентов?',
    answer:
      'Да. Данные изолированы по тенантам, передача идёт по HTTPS, а доступ ограничен ролевой моделью. Мы соответствуем требованиям 152-ФЗ.',
  },
];

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl divide-y divide-slate-100">
      {faqData.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={index} className="py-5">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : index)}
              className="flex w-full items-center justify-between text-left"
              aria-expanded={isOpen}
            >
              <span className="text-base font-medium text-slate-900">{item.question}</span>
              <span
                className={`ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-transform ${
                  isOpen ? 'rotate-180' : ''
                }`}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            {isOpen && (
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
