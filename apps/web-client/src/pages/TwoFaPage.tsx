import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { verify2fa, setCsrfToken } from '../lib/api';
import { useAuth } from '../lib/auth';
import { extractErrorMessage } from '../lib/errors';

const schema = z.object({
  code: z.string().length(6, 'Код должен содержать 6 цифр'),
});

type FormData = z.infer<typeof schema>;

export function TwoFaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuth();
  const twoFaToken = (location.state as { twoFaToken?: string })?.twoFaToken;
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  if (!twoFaToken) {
    return <Navigate to="/login" replace />;
  }

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      const result = await verify2fa(data.code, twoFaToken);
      setUser(result.user);
      if (result.csrfToken) {
        setCsrfToken(result.csrfToken);
      }
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setServerError(extractErrorMessage(err));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Двухфакторная аутентификация</h1>
        <p className="mt-1 text-sm text-slate-500">
          Введите 6-значный код из приложения-аутентификатора
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-slate-700">
              Код 2FA
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              {...register('code')}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
            {errors.code && (
              <p className="mt-1 text-sm text-red-600">{errors.code.message}</p>
            )}
          </div>
          {serverError && <p className="text-sm text-red-600">{serverError}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Проверка...' : 'Подтвердить'}
          </button>
        </form>
      </div>
    </div>
  );
}
