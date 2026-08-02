import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ensureCsrfToken, setCsrfToken } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';
import { useAuth } from '../lib/auth';

export function ImpersonatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setError('Отсутствует код имперсонации');
      return;
    }

    api
      .post<{ success: boolean; csrfToken?: string }>(
        '/admin/impersonation/exchange',
        { exchangeCode: code },
      )
      .then(async (res) => {
        if (res.data.csrfToken) {
          setCsrfToken(res.data.csrfToken);
        }
        await ensureCsrfToken();
        await refreshSession();
        navigate('/', { replace: true });
      })
      .catch((err) => {
        setError(extractErrorMessage(err));
      });
  }, [searchParams, navigate, refreshSession]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-card">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-red-700">
              Не удалось войти в аккаунт
            </h1>
            <p className="mt-2 text-sm text-slate-600">{error}</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-slate-900">Входим в аккаунт...</h1>
            <p className="mt-2 text-sm text-slate-600">Подождите несколько секунд.</p>
          </>
        )}
      </div>
    </div>
  );
}
