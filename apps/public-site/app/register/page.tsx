import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RegisterForm } from '@/components/RegisterForm';
import { CheckIcon } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Регистрация',
  description: 'Создайте аккаунт Monstro Chat AI и получите 7 дней триала без привязки карты',
};

export default function RegisterPage() {
  return (
    <div className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <span className="badge">7 дней бесплатно · без карты</span>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Запустите AI-продавца на сайте за 15 минут
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Пока вы заполняете форму — конкуренты забирают ваших клиентов. Подключите
              Monstro Chat AI и начните получать заявки уже сегодня.
            </p>
            <ul className="mt-8 space-y-4 text-slate-600">
              {[
                'Первые заявки — в день подключения',
                'ИИ отвечает 24/7, пока менеджеры спят',
                'Одна строчка кода — без программистов',
                'Отмена в любой момент, без обязательств',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                    <CheckIcon />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-8 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
              Средний рост заявок с сайта — <strong>+37%</strong> в первый месяц
            </p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft md:p-8">
            <h2 className="text-lg font-semibold text-slate-900">Создать аккаунт</h2>
            <p className="mt-1 text-sm text-slate-500">Займёт меньше минуты</p>
            <div className="mt-6">
              <Suspense fallback={<p className="text-center text-slate-500">Загрузка…</p>}>
                <RegisterForm />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
