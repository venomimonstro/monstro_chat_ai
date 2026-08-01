import type { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Новый пароль',
  description: 'Установка нового пароля в личном кабинете AI-Консультант',
};

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? '';
  const href = token
    ? `${siteConfig.clientAppUrl}/reset-password?token=${encodeURIComponent(token)}`
    : `${siteConfig.clientAppUrl}/forgot-password`;

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-3xl font-bold text-slate-900">Новый пароль</h1>
      <p className="mt-4 text-slate-600">
        Установка нового пароля выполняется в личном кабинете.
      </p>
      <Link
        href={href}
        className="mt-8 inline-flex rounded-xl bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
      >
        {token ? 'Задать новый пароль' : 'Запросить ссылку'}
      </Link>
    </div>
  );
}
