'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { siteConfig } from '@/lib/site';
import { isUuid } from '@/lib/uuid';

export function RegisterForm() {
  const searchParams = useSearchParams();
  const rawTariffId = searchParams.get('tariffId') ?? '';
  const tariffName = searchParams.get('tariffName') ?? '';
  const tariffId = isUuid(rawTariffId) ? rawTariffId : '';
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pdConsent, setPdConsent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!pdConsent) {
      setError('Необходимо согласие на обработку персональных данных');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${siteConfig.apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          companyName,
          email,
          password,
          pdConsent: true,
          tariffId: tariffId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message ?? 'Ошибка регистрации',
        );
        return;
      }
      if (data.user) {
        window.location.href = `${siteConfig.clientAppUrl}/login?registered=1`;
      }
    } catch {
      setError('Не удалось подключиться к API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {tariffName ? (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Выбран тариф: <strong>{tariffName}</strong>
        </div>
      ) : tariffId ? (
        <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Выбран тариф с сайта — оформление продолжится после регистрации
        </div>
      ) : null}
      <div>
        <label htmlFor="companyName" className="block text-sm font-medium text-slate-700">
          Название компании
        </label>
        <input
          id="companyName"
          type="text"
          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
          minLength={2}
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Пароль
        </label>
        <input
          id="password"
          type="password"
          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      <label className="flex items-start gap-3 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={pdConsent}
          onChange={(e) => setPdConsent(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span>
          Я согласен(на) на{' '}
          <Link href="/legal/consent" className="text-brand-600 underline hover:text-brand-700">
            обработку персональных данных
          </Link>{' '}
          и принимаю{' '}
          <Link href="/legal/terms" className="text-brand-600 underline hover:text-brand-700">
            публичную оферту
          </Link>
        </span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-brand-600 px-4 py-3 font-medium text-white shadow-lg shadow-brand-500/20 transition hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? 'Создание…' : 'Начать бесплатно — 7 дней триала'}
      </button>
      <p className="text-center text-xs text-slate-500">
        Уже есть аккаунт?{' '}
        <a href={`${siteConfig.clientAppUrl}/login`} className="text-brand-600 hover:underline">
          Войти
        </a>
      </p>
    </form>
  );
}
