import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { verifyAdmin2fa } from '../lib/api';
import { extractErrorMessage } from '../lib/errors';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, refreshSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaToken, setTwoFaToken] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setLoading(true);

    try {
      if (twoFaToken) {
        await verifyAdmin2fa({ code: twoFaCode, twoFaToken });
        await refreshSession();
        navigate('/');
        return;
      }

      const result = await login(email, password);
      if (result.requires2fa) {
        setTwoFaToken(result.twoFaToken ?? null);
      } else {
        navigate('/');
      }
    } catch (err) {
      setServerError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8">
        <h1 className="text-2xl font-bold">RedFlow — вход в админку</h1>
        <p className="mt-1 text-sm text-slate-400">Только для Owner и Admin</p>

        {serverError && (
          <div className="mt-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
            {serverError}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {!twoFaToken ? (
            <>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                  Пароль
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="twoFaCode" className="block text-sm font-medium text-slate-300">
                Код двухфакторной аутентификации
              </label>
              <input
                id="twoFaCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={twoFaCode}
                onChange={(e) => setTwoFaCode(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Вход...' : twoFaToken ? 'Подтвердить' : 'Войти'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/" className="text-brand-400 hover:text-brand-300">
            Вернуться на дашборд
          </Link>
        </p>
      </div>
    </div>
  );
}
