'use client';

import { useState } from 'react';
import { faqData } from '@/lib/faq';

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
