import { useEffect, useState } from 'react';
import {
  extractApiError,
  fetchPlatformWorkspace,
  fetchSiteSettings,
  openPlatformWorkspace,
  syncPlatformWidget,
  updateSiteSettings,
} from '../lib/api';
import type { PlatformWorkspaceDto, PublicSiteSettingsDto } from '@ai-consultant/shared-types';
import { EmptyState, ErrorState, LoadingState } from '../components/UiState';

export function SiteSettingsPage() {
  const [settings, setSettings] = useState<PublicSiteSettingsDto | null>(null);
  const [workspace, setWorkspace] = useState<PlatformWorkspaceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openingWorkspace, setOpeningWorkspace] = useState(false);
  const [syncingWidget, setSyncingWidget] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [demoWidgetKey, setDemoWidgetKey] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [welcomeTitle, setWelcomeTitle] = useState('');
  const [welcomeText, setWelcomeText] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchSiteSettings(),
      fetchPlatformWorkspace().catch(() => null),
    ])
      .then(([data, ws]) => {
        setSettings(data);
        setWorkspace(ws);
        setDemoWidgetKey(data.demoWidgetKey);
        setChatEnabled(data.chatEnabled);
        setWelcomeTitle(data.welcomeTitle);
        setWelcomeText(data.welcomeText);
      })
      .catch(() => setError('Не удалось загрузить настройки'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateSiteSettings({
        demoWidgetKey,
        chatEnabled,
        welcomeTitle,
        welcomeText,
      });
      setSettings(updated);
      setMessage('Настройки сохранены');
    } catch (err) {
      setMessage(extractApiError(err, 'Не удалось сохранить настройки'));
    } finally {
      setSaving(false);
    }
  };

  const syncWidget = async () => {
    setSyncingWidget(true);
    setMessage(null);
    try {
      const updated = await syncPlatformWidget();
      setSettings(updated);
      setDemoWidgetKey(updated.demoWidgetKey);
      setChatEnabled(updated.chatEnabled);
      setMessage('Ключ AI-виджета платформы применён — чат появится на публичном сайте');
    } catch (err) {
      setMessage(extractApiError(err, 'Не удалось синхронизировать виджет'));
    } finally {
      setSyncingWidget(false);
    }
  };

  const openWorkspace = async () => {
    setOpeningWorkspace(true);
    try {
      const result = await openPlatformWorkspace();
      const url = `${result.webClientUrl.replace(/\/$/, '')}/impersonate?code=${encodeURIComponent(result.exchangeCode)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setMessage(extractApiError(err, 'Не удалось открыть ЛК платформы'));
    } finally {
      setOpeningWorkspace(false);
    }
  };

  if (loading) return <LoadingState message="Загрузка настроек…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!settings) return <EmptyState title="Нет данных" />;

  return (
    <div className="max-w-2xl space-y-6">
      {message && (
        <p className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">
          {message}
        </p>
      )}
        {workspace && (
          <section className="rounded-xl border border-brand-500/30 bg-brand-950/20 p-5">
            <h2 className="text-lg font-semibold text-slate-100">ЛК платформы</h2>
            <p className="mt-1 text-sm text-slate-400">
              Отдельный рабочий аккаунт для лидов с публичного сайта: CRM, источники,
              статистика — как у клиентов.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Тенант: {workspace.tenantName} · widget key: {workspace.widgetKey}
            </p>
            <button
              type="button"
              disabled={openingWorkspace}
              onClick={openWorkspace}
              className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {openingWorkspace ? 'Открываем…' : 'Открыть ЛК платформы'}
            </button>
          </section>
        )}

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold text-slate-100">AI-чат на публичном сайте</h2>
          <p className="mt-1 text-sm text-slate-400">
            Наш виджет AI-консультанта в правом нижнем углу — тот же, что клиенты ставят на свои
            сайты после регистрации или покупки тарифа. Ключ создаётся автоматически для платформы.
          </p>

          {workspace && demoWidgetKey !== workspace.widgetKey && (
            <p className="mt-3 rounded-lg border border-amber-700/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
              Ключ не совпадает с платформенным источником ({workspace.widgetKey.slice(0, 12)}…).
            </p>
          )}

          <label className="mt-4 block">
            <span className="text-sm text-slate-300">Widget key (источник «Публичный сайт»)</span>
            <input
              type="text"
              value={demoWidgetKey}
              onChange={(e) => setDemoWidgetKey(e.target.value)}
              placeholder="wk_..."
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            {workspace && (
              <button
                type="button"
                disabled={syncingWidget}
                onClick={syncWidget}
                className="rounded-lg border border-brand-600/50 px-3 py-2 text-sm text-brand-300 hover:bg-brand-950/30 disabled:opacity-50"
              >
                {syncingWidget ? 'Синхронизация…' : 'Применить ключ платформы'}
              </button>
            )}
          </div>

          <label className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={chatEnabled}
              onChange={(e) => setChatEnabled(e.target.checked)}
              className="rounded border-slate-600"
            />
            <span className="text-sm text-slate-300">Показывать AI-чат на публичном сайте</span>
          </label>

          <div className="mt-4 rounded-lg bg-slate-800/50 p-3 text-xs text-slate-400">
            <p>API: {settings.apiUrl}</p>
            <p className="mt-1">Виджет: {settings.widgetUrl}</p>
            <p className="mt-1">
              Статус:{' '}
              {settings.enabled ? (
                <span className="text-emerald-400">активен</span>
              ) : (
                <span className="text-amber-400">не настроен</span>
              )}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Тексты на лендинге</h2>
          <p className="mt-1 text-sm text-slate-400">
            Заголовок и описание блока с демо-чатом
          </p>

          <label className="mt-4 block">
            <span className="text-sm text-slate-300">Заголовок</span>
            <input
              type="text"
              value={welcomeTitle}
              onChange={(e) => setWelcomeTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-sm text-slate-300">Описание</span>
            <textarea
              value={welcomeText}
              onChange={(e) => setWelcomeText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </label>
        </section>

        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
    </div>
  );
}
