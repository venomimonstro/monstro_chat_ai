'use client';

import { useState } from 'react';
import Link from 'next/link';
import { siteConfig } from '@/lib/site';

interface ResetPasswordFormProps {
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    if (password.length < 8) {
      setError('Минимум 8 символов');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${siteConfig.apiUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message ?? 'Не удалось обновить пароль',
        );
        return;
      }
      setDone(true);
    } catch {
      setError('Не удалось подключиться к API');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-slate-700">Ссылка для сброса пароля недействительна.</p>
        <Link href="/forgot-password" className="mt-4 inline-block text-brand-600 hover:underline">
          Запросить новую ссылку
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Пароль успешно обновлён. Теперь можно войти с новым паролем.
        </div>
        <a
          href={`${siteConfig.clientAppUrl}/login`}
          className="inline-flex rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Войти в личный кабинет
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Новый пароль
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
      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
          Повторите пароль
        </label>
        <input
          id="confirm"
          type="password"
          className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-brand-600 px-4 py-3 font-medium text-white shadow-lg shadow-brand-500/20 transition hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? 'Сохранение…' : 'Сохранить пароль'}
      </button>
    </form>
  );
}
