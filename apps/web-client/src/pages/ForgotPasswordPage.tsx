import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { requestPasswordReset } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';

const schema = z.object({
  email: z.string().email('Введите корректный email'),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      await requestPasswordReset(data.email);
      setSent(true);
    } catch (err: unknown) {
      setServerError(extractErrorMessage(err));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Восстановление пароля</h1>
        <p className="mt-1 text-sm text-slate-500">
          Укажите email — мы отправим ссылку для сброса пароля
        </p>

        {sent ? (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            Если аккаунт с таким email существует, мы отправили инструкции по сбросу пароля.
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
            {serverError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {serverError}
              </div>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Отправка…' : 'Отправить ссылку'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Вернуться ко входу
          </Link>
        </p>
      </div>
    </div>
  );
}
