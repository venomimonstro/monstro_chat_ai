'use client';

import { useState } from 'react';

interface FaqItem {
  question: string;
  answer: string;
}

const faqData: FaqItem[] = [
  {
    question: 'Сложно ли подключить чат к сайту?',
    answer:
      'Нет, это займёт около 5 минут. Достаточно вставить одну строку кода на сайт — без программистов и технической возни с вашей стороны.',
  },
  {
    question: 'Чат правда работает круглосуточно?',
    answer:
      'Да. Monstro Chat AI отвечает посетителям 24/7 — ночью, в выходные и праздники. Вы получаете заявки даже тогда, когда менеджеры недоступны.',
  },
  {
    question: 'AI действительно отвечает как живой человек?',
    answer:
      'Да, он понимает смысл вопроса и общается естественно. Клиент получает вежливый и точный ответ по вашим услугам — будто пишет вашему лучшему менеджеру.',
  },
  {
    question: 'Откуда чат знает информацию о моём бизнесе?',
    answer:
      'Он обучается на данных о ваших услугах, ценах и условиях. Вы можете дополнять сведения в любой момент — чат сразу начнёт отвечать по-новому.',
  },
  {
    question: 'Куда будут приходить заявки?',
    answer:
      'В amoCRM, Битрикс24, на почту или в удобный мессенджер. Все контакты сохраняются с контекстом диалога — ничего не теряется.',
  },
  {
    question: 'А если AI не знает ответа на вопрос?',
    answer:
      'Чат корректно возьмёт контакт клиента и передаст диалог вам — ни один потенциальный клиент не останется без внимания.',
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
              <p className="mt-3 text-sm leading-6 text-ink-700">{item.answer}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
