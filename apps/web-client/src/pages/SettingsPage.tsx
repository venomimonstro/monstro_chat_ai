import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { HelpTooltip } from '../components/HelpTooltip';
import { SkeletonCard } from '../components/Skeleton';
import { ErrorState } from '../components/EmptyState';
import { extractErrorMessage } from '../lib/errors';
import {
  disable2fa,
  enable2fa,
  fetchTenant,
  setup2fa,
  updateTenant,
} from '../lib/settings';
import { downloadTenantDataJson } from '../lib/export';
import { Link } from 'react-router-dom';

export function SettingsPage() {
  const { user } = useAuth();
  const [tenantName, setTenantName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [twoFaSecret, setTwoFaSecret] = useState<string | null>(null);
  const [twoFaUrl, setTwoFaUrl] = useState<string | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const tenant = await fetchTenant();
      setTenantName(tenant.name);
      setTenantId(tenant.id);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveCompany = async () => {
    if (!tenantId) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateTenant(tenantId, tenantName.trim());
      setMessage('Название компании сохранено');
    } catch (err: unknown) {
      setMessage(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const start2fa = async () => {
    setTwoFaLoading(true);
    setMessage(null);
    try {
      const data = await setup2fa();
      setTwoFaSecret(data.secret);
      setTwoFaUrl(data.otpauthUrl);
    } catch (err: unknown) {
      setMessage(extractErrorMessage(err));
    } finally {
      setTwoFaLoading(false);
    }
  };

  const confirm2fa = async () => {
    setTwoFaLoading(true);
    try {
      await enable2fa(twoFaCode);
      setTwoFaSecret(null);
      setTwoFaUrl(null);
      setTwoFaCode('');
      setMessage('Двухфакторная аутентификация включена');
    } catch (err: unknown) {
      setMessage(extractErrorMessage(err));
    } finally {
      setTwoFaLoading(false);
    }
  };

  const turnOff2fa = async () => {
    if (!confirm('Отключить 2FA?')) return;
    setTwoFaLoading(true);
    try {
      await disable2fa();
      setMessage('2FA отключена');
    } catch (err: unknown) {
      setMessage(extractErrorMessage(err));
    } finally {
      setTwoFaLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Настройки" description="Профиль, компания и безопасность" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Настройки"
        description="Профиль, компания и безопасность"
      />

      {message && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <section className="lk-card">
        <h2 className="text-lg font-semibold text-slate-900">
          Профиль
          <HelpTooltip text="Email используется для входа и уведомлений" />
        </h2>
        <label className="mt-4 block text-sm">
          <span className="text-slate-600">Email</span>
          <input className="lk-input mt-1 bg-slate-50" value={user?.email ?? ''} readOnly />
        </label>
      </section>

      <section className="lk-card">
        <h2 className="text-lg font-semibold text-slate-900">Компания</h2>
        <label className="mt-4 block text-sm">
          <span className="text-slate-600">Название</span>
          <input
            className="lk-input mt-1"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={saving || !tenantName.trim()}
          onClick={saveCompany}
          className="lk-btn-primary mt-4"
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </section>

      <section className="lk-card">
        <h2 className="text-lg font-semibold text-slate-900">
          Двухфакторная аутентификация
          <HelpTooltip
            text="Дополнительная защита при входе через приложение-аутентификатор"
            href="https://support.google.com/accounts/answer/1066447"
          />
        </h2>
        {!twoFaSecret ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={twoFaLoading}
              onClick={start2fa}
              className="lk-btn-primary"
            >
              Настроить 2FA
            </button>
            <button
              type="button"
              disabled={twoFaLoading}
              onClick={turnOff2fa}
              className="lk-btn-secondary"
            >
              Отключить 2FA
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">
              Добавьте ключ в приложение (Google Authenticator, 1Password и т.д.):
            </p>
            <code className="block break-all rounded-lg bg-slate-100 p-3 text-xs">
              {twoFaSecret}
            </code>
            {twoFaUrl ? (
              <a
                href={twoFaUrl}
                className="text-sm text-brand-600 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Открыть в приложении
              </a>
            ) : null}
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm">
                <span className="text-slate-600">Код из приложения</span>
                <input
                  className="lk-input mt-1 w-40"
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                />
              </label>
              <button
                type="button"
                disabled={twoFaLoading || twoFaCode.length < 6}
                onClick={confirm2fa}
                className="lk-btn-primary"
              >
                Подтвердить
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="lk-card">
        <h2 className="text-lg font-semibold text-slate-900">Команда</h2>
        <p className="mt-2 text-sm text-slate-500">
          Пригласите менеджеров для работы с CRM и чатами.
        </p>
        <Link to="/team" className="lk-btn-primary mt-4 inline-block">
          Управление командой
        </Link>
      </section>

      <section className="lk-card">
        <h2 className="text-lg font-semibold text-slate-900">Экспорт данных (GDPR)</h2>
        <p className="mt-2 text-sm text-slate-500">
          Скачайте архив лидов, диалогов и сообщений вашего тенанта в формате JSON.
        </p>
        <button
          type="button"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              await downloadTenantDataJson();
              setMessage('Экспорт загружен');
            } catch (err: unknown) {
              setError(extractErrorMessage(err));
            } finally {
              setExporting(false);
            }
          }}
          className="lk-btn-primary mt-4"
        >
          {exporting ? 'Подготовка…' : 'Скачать данные'}
        </button>
      </section>

      <section className="lk-card">
        <h2 className="text-lg font-semibold text-slate-900">Уведомления</h2>
        <p className="mt-2 text-sm text-slate-500">
          Email-уведомления о лидах и лимитах настраиваются в разделе{' '}
          <a href="/integrations" className="text-brand-600 hover:underline">
            Интеграции → Уведомления о лидах
          </a>
          .
        </p>
      </section>

      <section className="lk-card">
        <h2 className="text-lg font-semibold text-slate-900">Справка</h2>
        <ul className="mt-3 space-y-2 text-sm text-brand-600">
          <li>
            <a href="/docs/WIDGET-PERFORMANCE.md" className="hover:underline">
              Рекомендации по установке виджета
            </a>
          </li>
          <li>
            <a href="/docs/WIDGET-UX-CHECKLIST.md" className="hover:underline">
              Чек-лист UX виджета
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
