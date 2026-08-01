import { useEffect, useState } from 'react';
import {
  fetchSiteSettings,
  updateSiteSettings,
} from '../lib/api';
import type { PublicSiteSettingsDto } from '@ai-consultant/shared-types';
import { EmptyState, ErrorState, LoadingState } from '../components/UiState';

export function SiteSettingsPage() {
  const [settings, setSettings] = useState<PublicSiteSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [demoWidgetKey, setDemoWidgetKey] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [welcomeTitle, setWelcomeTitle] = useState('');
  const [welcomeText, setWelcomeText] = useState('');

  const load = () => {
    setLoading(true);
    setError(null);
    fetchSiteSettings()
      .then((data) => {
        setSettings(data);
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
    } catch {
      setMessage('Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Загрузка настроек…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!settings) return <EmptyState title="Нет данных" />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Настройки публичного сайта</h1>
        <p className="mt-1 text-sm text-slate-400">
          Виджет чата на лендинге и демо-странице
        </p>
        {message && (
          <p className="mt-2 text-sm text-emerald-400">{message}</p>
        )}
      </div>

      <div className="max-w-2xl space-y-6">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Виджет чата</h2>
          <p className="mt-1 text-sm text-slate-400">
            Укажите ключ виджета (widget key) из источника клиента. Чат появится
            на публичном сайте в правом нижнем углу.
          </p>

          <label className="mt-4 block">
            <span className="text-sm text-slate-300">Widget key</span>
            <input
              type="text"
              value={demoWidgetKey}
              onChange={(e) => setDemoWidgetKey(e.target.value)}
              placeholder="wk_..."
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={chatEnabled}
              onChange={(e) => setChatEnabled(e.target.checked)}
              className="rounded border-slate-600"
            />
            <span className="text-sm text-slate-300">Показывать чат на сайте</span>
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
    </div>
  );
}
