import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { resetPassword } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';

const schema = z
  .object({
    password: z.string().min(8, 'Минимум 8 символов'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'Пароли не совпадают',
    path: ['confirm'],
  });

type FormData = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    if (!token) {
      setServerError('Ссылка недействительна');
      return;
    }
    setServerError('');
    try {
      await resetPassword(token, data.password);
      navigate('/login', { replace: true, state: { message: 'Пароль обновлён' } });
    } catch (err: unknown) {
      setServerError(extractErrorMessage(err));
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-slate-700">Ссылка для сброса пароля недействительна.</p>
          <Link to="/forgot-password" className="mt-4 inline-block text-brand-600 hover:underline">
            Запросить новую ссылку
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Новый пароль</h1>
        <p className="mt-1 text-sm text-slate-500">Придумайте новый пароль для входа</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              {...register('password')}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
              Повторите пароль
            </label>
            <input
              id="confirm"
              type="password"
              {...register('confirm')}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {errors.confirm && (
              <p className="mt-1 text-sm text-red-600">{errors.confirm.message}</p>
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
            {isSubmitting ? 'Сохранение…' : 'Сохранить пароль'}
          </button>
        </form>
      </div>
    </div>
  );
}
