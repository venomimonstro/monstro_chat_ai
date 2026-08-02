import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { loginUser } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import { useAuth } from '../lib/auth';

const schema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const [serverError, setServerError] = useState('');
  const params = new URLSearchParams(location.search);
  const successMessage =
    params.get('registered') === '1'
      ? 'Аккаунт создан. Войдите, чтобы продолжить настройку.'
      : params.get('reset') === '1' ||
          (location.state as { message?: string } | null)?.message
        ? 'Пароль обновлён. Войдите с новым паролем.'
        : '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      const result = await loginUser(data.email, data.password);

      if (result.requires2fa && result.twoFaToken) {
        navigate('/2fa', { state: { twoFaToken: result.twoFaToken } });
        return;
      }

      setUser(result.user);
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setServerError(extractErrorMessage(err));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Вход</h1>
        <p className="mt-1 text-sm text-slate-500">
          Войдите в личный кабинет Monstro Chat AI
        </p>

        {successMessage && (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {successMessage}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              {...register('password')}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
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
            {isSubmitting ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link to="/forgot-password" className="font-medium text-brand-600 hover:text-brand-700">
            Забыли пароль?
          </Link>
        </p>

        <p className="mt-4 text-center text-sm text-slate-500">
          Нет аккаунта?{' '}
          <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
