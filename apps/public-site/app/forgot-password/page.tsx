import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Восстановление пароля',
  description: 'Сброс пароля для личного кабинета Monstro Chat AI',
};

export default function ForgotPasswordPage() {
  return (
    <div className="bg-slate-50">
      <div className="mx-auto max-w-md px-4 py-16 md:py-24">
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-soft md:p-8">
          <h1 className="text-2xl font-bold text-slate-900">Восстановление пароля</h1>
          <p className="mt-2 text-sm text-slate-600">
            Укажите email — мы отправим ссылку для сброса пароля
          </p>
          <div className="mt-6">
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}
