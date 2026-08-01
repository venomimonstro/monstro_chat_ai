import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { registerUser } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import { useAuth } from '../lib/auth';

const schema = z.object({
  companyName: z.string().min(2, 'Минимум 2 символа'),
  email: z.string().email('Введите корректный email'),
  password: z.string().min(8, 'Минимум 8 символов'),
  pdConsent: z.literal(true, {
    errorMap: () => ({ message: 'Необходимо согласие на обработку ПД' }),
  }),
});

type FormData = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tariffId = searchParams.get('tariffId') ?? undefined;
  const { setUser } = useAuth();
  const [emailError, setEmailError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (tariffId) {
      document.title = `Регистрация · тариф ${tariffId}`;
    }
  }, [tariffId]);

  const onSubmit = async (data: FormData) => {
    setEmailError('');
    try {
      const result = await registerUser({
        companyName: data.companyName,
        email: data.email,
        password: data.password,
        pdConsent: true,
        tariffId,
      });
      setUser(result.user);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const response = (err as { response?: { status?: number; data?: { message?: string } } })
        ?.response;
      if (response?.status === 409) {
        setEmailError('Пользователь с таким email уже существует');
      } else {
        setEmailError(extractErrorMessage(err));
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Регистрация</h1>
        <p className="mt-1 text-sm text-slate-500">
          7 дней бесплатного триала — без привязки карты
        </p>
        {tariffId && (
          <p className="mt-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
            Выбранный тариф будет применён после регистрации
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="company" className="block text-sm font-medium text-slate-700">
              Название компании
            </label>
            <input
              id="company"
              type="text"
              {...register('companyName')}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            {errors.companyName && (
              <p className="mt-1 text-sm text-red-600">{errors.companyName.message}</p>
            )}
          </div>
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
            {emailError && (
              <p className="mt-1 text-sm text-red-600">{emailError}</p>
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
          <label className="flex items-start gap-3 text-sm text-slate-600">
            <input type="checkbox" {...register('pdConsent')} className="mt-1" />
            <span>
              Я согласен(на) на{' '}
              <a
                href="http://localhost:4321/legal/consent"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 underline"
              >
                обработку персональных данных
              </a>{' '}
              и принимаю{' '}
              <a
                href="http://localhost:4321/legal/terms"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 underline"
              >
                публичную оферту
              </a>
            </span>
          </label>
          {errors.pdConsent && (
            <p className="text-sm text-red-600">{errors.pdConsent.message}</p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Создание...' : 'Создать аккаунт'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
