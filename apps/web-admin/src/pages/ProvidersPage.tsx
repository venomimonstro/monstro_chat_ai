import { useEffect, useState } from 'react';
import {
  clearProviderCredentials,
  extractApiError,
  fetchAdminProviders,
  setProviderCredentials,
  testProviderCredentials,
  updateAdminProviders,
  type LlmProviderInfo,
  type ProviderTestResult,
} from '../lib/api';
import { EmptyState, ErrorState, LoadingState } from '../components/UiState';

function keySourceLabel(source: LlmProviderInfo['keySource']) {
  switch (source) {
    case 'redis':
      return 'Ключ в админке';
    case 'env':
      return 'Ключ из env';
    default:
      return 'Ключ не задан';
  }
}

export function ProvidersPage() {
  const [providers, setProviders] = useState<LlmProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<'ok' | 'error'>('ok');
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [keySaving, setKeySaving] = useState<string | null>(null);
  const [keyTesting, setKeyTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ProviderTestResult>>({});

  const notify = (text: string | null, tone: 'ok' | 'error' = 'ok') => {
    setMessage(text);
    setMessageTone(tone);
  };

  const load = () => {
    setLoading(true);
    setError(null);
    fetchAdminProviders()
      .then(setProviders)
      .catch(() => setError('Не удалось загрузить провайдеры'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const persist = async (next: LlmProviderInfo[]) => {
    setSaving(true);
    notify(null);
    try {
      const chain = next.map((p) => p.name);
      const disabled = next.filter((p) => !p.enabled).map((p) => p.name);
      const updated = await updateAdminProviders({ chain, disabled });
      setProviders(updated);
      notify('Конфигурация сохранена');
    } catch (err) {
      notify(extractApiError(err, 'Не удалось сохранить'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= providers.length) return;
    const next = [...providers];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setProviders(next.map((p, i) => ({ ...p, priority: i + 1 })));
    persist(next);
  };

  const toggle = (name: string) => {
    const next = providers.map((p) =>
      p.name === name ? { ...p, enabled: !p.enabled } : p,
    );
    setProviders(next);
    persist(next);
  };

  const saveKey = async (name: string) => {
    const apiKey = keyInputs[name]?.trim();
    if (!apiKey) return;
    setKeySaving(name);
    notify(null);
    try {
      const updated = await setProviderCredentials(name, apiKey);
      setProviders(updated);
      setKeyInputs((prev) => ({ ...prev, [name]: '' }));
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      notify(`Ключ ${name} сохранён`);
    } catch (err) {
      notify(extractApiError(err, `Не удалось сохранить ключ ${name}`), 'error');
    } finally {
      setKeySaving(null);
    }
  };

  const clearKey = async (name: string) => {
    setKeySaving(name);
    notify(null);
    try {
      const updated = await clearProviderCredentials(name);
      setProviders(updated);
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      notify(`Ключ ${name} удалён (используется env, если задан)`);
    } catch (err) {
      notify(extractApiError(err, `Не удалось удалить ключ ${name}`), 'error');
    } finally {
      setKeySaving(null);
    }
  };

  const testKey = async (name: string) => {
    setKeyTesting(name);
    notify(null);
    try {
      const result = await testProviderCredentials(name);
      setTestResults((prev) => ({ ...prev, [name]: result }));
      if (result.ok) {
        notify(
          `${name}: ключ работает (${result.model}, ${result.latencyMs} мс)`,
        );
      } else {
        notify(result.error ?? 'Провайдер вернул ошибку', 'error');
      }
    } catch (err) {
      notify(extractApiError(err, `Не удалось проверить ключ ${name}`), 'error');
    } finally {
      setKeyTesting(null);
    }
  };

  if (loading) return <LoadingState message="Загрузка провайдеров…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">LLM-провайдеры</h1>
        <p className="mt-1 text-sm text-slate-400">
          Приоритет fallback-цепочки, ключи API и включение провайдеров
        </p>
        {message && (
          <p
            className={`mt-2 text-sm ${
              messageTone === 'error' ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {message}
          </p>
        )}
      </div>

      {providers.length === 0 ? (
        <EmptyState
          title="Провайдеры не настроены"
          description="Проверьте конфигурацию API."
        />
      ) : (
        <div className="space-y-3">
          {providers.map((provider, index) => (
            <div
              key={provider.name}
              className="rounded-xl border border-slate-800 bg-slate-900 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">#{provider.priority}</span>
                    <h2 className="text-lg font-semibold capitalize text-slate-100">
                      {provider.name}
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    Модель: {provider.defaultModel}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    API key: {provider.apiKeyMasked ?? '—'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Источник: {keySourceLabel(provider.keySource)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill
                    label={provider.available ? 'Ключ задан' : 'Нет ключа'}
                    ok={provider.available}
                  />
                  <Pill
                    label={provider.enabled ? 'Включён' : 'Выключен'}
                    ok={provider.enabled}
                  />
                </div>
              </div>

              {testResults[provider.name] && (
                <p
                  className={`mt-3 text-sm ${
                    testResults[provider.name].ok ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {testResults[provider.name].ok
                    ? `Проверка OK — ${testResults[provider.name].model}, ${testResults[provider.name].latencyMs} мс`
                    : `Ошибка: ${testResults[provider.name].error ?? 'неизвестная'}`}
                </p>
              )}

              {provider.name !== 'mock' && (
                <div className="mt-4 flex flex-wrap items-end gap-2">
                  <label className="min-w-[240px] flex-1">
                    <span className="text-xs text-slate-400">Новый API-ключ</span>
                    <input
                      type="password"
                      value={keyInputs[provider.name] ?? ''}
                      onChange={(e) =>
                        setKeyInputs((prev) => ({
                          ...prev,
                          [provider.name]: e.target.value,
                        }))
                      }
                      placeholder="sk-..."
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={keySaving === provider.name || !keyInputs[provider.name]?.trim()}
                    onClick={() => saveKey(provider.name)}
                    className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-40"
                  >
                    {keySaving === provider.name ? '…' : 'Сохранить ключ'}
                  </button>
                  <button
                    type="button"
                    disabled={
                      keyTesting === provider.name ||
                      !provider.available ||
                      keySaving === provider.name
                    }
                    onClick={() => testKey(provider.name)}
                    className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300 disabled:opacity-40"
                  >
                    {keyTesting === provider.name ? 'Проверка…' : 'Проверить ключ'}
                  </button>
                  {provider.apiKeyMasked && (
                    <button
                      type="button"
                      disabled={keySaving === provider.name}
                      onClick={() => clearKey(provider.name)}
                      className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300 disabled:opacity-40"
                    >
                      Удалить ключ
                    </button>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || index === 0}
                  onClick={() => move(index, -1)}
                  className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-300 disabled:opacity-40"
                >
                  ↑ Выше
                </button>
                <button
                  type="button"
                  disabled={saving || index === providers.length - 1}
                  onClick={() => move(index, 1)}
                  className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-300 disabled:opacity-40"
                >
                  ↓ Ниже
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => toggle(provider.name)}
                  className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-300"
                >
                  {provider.enabled ? 'Отключить' : 'Включить'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Pill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ok ? 'bg-emerald-900/50 text-emerald-300' : 'bg-amber-900/50 text-amber-300'
      }`}
    >
      {label}
    </span>
  );
}
