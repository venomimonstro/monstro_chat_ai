'use client';

import { useState } from 'react';
import Link from 'next/link';
import { siteConfig } from '@/lib/site';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${siteConfig.apiUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message ?? 'Не удалось отправить ссылку',
        );
        return;
      }
      setSent(true);
    } catch {
      setError('Не удалось подключиться к API');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Если аккаунт с таким email существует, мы отправили инструкции по сбросу пароля.
        Проверьте почту и перейдите по ссылке из письма.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-brand-600 px-4 py-3 font-medium text-white shadow-lg shadow-brand-500/20 transition hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? 'Отправка…' : 'Отправить ссылку'}
      </button>
      <p className="text-center text-sm text-slate-500">
        <Link href={`${siteConfig.clientAppUrl}/login`} className="text-brand-600 hover:underline">
          Вернуться ко входу
        </Link>
      </p>
    </form>
  );
}
