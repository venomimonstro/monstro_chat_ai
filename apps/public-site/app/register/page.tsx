import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RegisterForm } from '@/components/RegisterForm';
import { CheckIcon } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Регистрация',
  description: 'Создайте аккаунт AI-Консультант и получите 7 дней триала без привязки карты',
};

export default function RegisterPage() {
  return (
    <div className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Создайте аккаунт
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              7 дней бесплатного триала — без привязки карты. Начните общаться с
              посетителями уже сегодня.
            </p>
            <ul className="mt-8 space-y-4 text-slate-600">
              {[
                'ИИ-ответы по вашей базе знаний',
                'Сбор лидов и CRM-интеграции',
                'Аналитика и отчёты',
                'Безопасность и 152-ФЗ',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                    <CheckIcon />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft md:p-8">
            <Suspense fallback={<p className="text-center text-slate-500">Загрузка…</p>}>
              <RegisterForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
