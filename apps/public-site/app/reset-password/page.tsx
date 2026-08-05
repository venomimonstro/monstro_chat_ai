import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Новый пароль',
  description: 'Установка нового пароля в личном кабинете RedFlow',
};

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? '';

  return (
    <div className="bg-slate-50">
      <div className="mx-auto max-w-md px-4 py-16 md:py-24">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft md:p-8">
          <h1 className="text-2xl font-bold text-slate-900">Новый пароль</h1>
          <p className="mt-2 text-sm text-slate-600">Придумайте новый пароль для входа</p>
          <div className="mt-6">
            <ResetPasswordForm token={token} />
          </div>
        </div>
      </div>
    </div>
  );
}
