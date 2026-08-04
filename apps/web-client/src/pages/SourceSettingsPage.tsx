import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { SourceConfig, SourceDto, LeadProfileMode } from '@ai-consultant/shared-types';
import { DEFAULT_SOURCE_CONFIG, mergeSourceConfig } from '@ai-consultant/shared-types';
import { api } from '../lib/api';
import { updateSource } from '../lib/sources';
import { extractErrorMessage } from '../lib/errors';
import { TrainingTab } from '../components/TrainingTab';
import { PromptTab } from '../components/PromptTab';
import { PersonaSettings } from '../components/PersonaSettings';
import { SkeletonCard } from '../components/Skeleton';

const WIDGET_PREVIEW_BASE = (() => {
  const raw = (import.meta.env.VITE_WIDGET_URL ?? 'http://localhost:5175').replace(/\/$/, '');
  return raw.endsWith('/iframe') ? raw : `${raw}/iframe`;
})();

function getPreviewApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (typeof envUrl === 'string' && envUrl.startsWith('http')) {
    return envUrl.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }
  return 'http://127.0.0.1:3000/api';
}

export function SourceSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [source, setSource] = useState<SourceDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [config, setConfig] = useState<SourceConfig>(DEFAULT_SOURCE_CONFIG);
  const [tab, setTab] = useState<
    'appearance' | 'general' | 'training' | 'prompt' | 'persona'
  >('appearance');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoadError(null);
    api
      .get<SourceDto>(`/sources/${id}`)
      .then((res) => {
        setSource(res.data);
        setConfig(mergeSourceConfig(res.data.config));
      })
      .catch(() => {
        setLoadError('Источник не найден или нет доступа');
      });
  }, [id]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'aicw:config', config },
      '*',
    );
  }, [config]);

  const patchAppearance = (patch: Partial<SourceConfig['appearance']>) => {
    setConfig((c) => ({ ...c, appearance: { ...c.appearance, ...patch } }));
    setSaved(false);
  };

  const patchPersonalization = (
    patch: Partial<SourceConfig['personalization']>,
  ) => {
    setConfig((c) => ({
      ...c,
      personalization: { ...c.personalization, ...patch },
    }));
    setSaved(false);
  };

  const patchAi = (patch: Partial<NonNullable<SourceConfig['ai']>>) => {
    setConfig((c) => ({
      ...c,
      ai: { ...c.ai, ...patch },
    }));
    setSaved(false);
  };

  const addQuickReply = () => {
    setConfig((c) => ({
      ...c,
      behavior: {
        ...c.behavior,
        quickReplies: [...(c.behavior.quickReplies ?? []), ''],
      },
    }));
    setSaved(false);
  };

  const updateQuickReply = (index: number, value: string) => {
    setConfig((c) => {
      const replies = [...(c.behavior.quickReplies ?? [])];
      replies[index] = value;
      return { ...c, behavior: { ...c.behavior, quickReplies: replies } };
    });
    setSaved(false);
  };

  const removeQuickReply = (index: number) => {
    setConfig((c) => {
      const replies = [...(c.behavior.quickReplies ?? [])];
      replies.splice(index, 1);
      return { ...c, behavior: { ...c.behavior, quickReplies: replies } };
    });
    setSaved(false);
  };

  const save = async () => {
    if (!id) return;
    setSaving(true);
    setLoadError(null);
    try {
      const updated = await updateSource(id, { config });
      setSource(updated);
      setSaved(true);
    } catch (err) {
      setLoadError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">{loadError}</p>
        <button
          type="button"
          onClick={() => navigate('/sources')}
          className="text-sm text-brand-600 hover:text-brand-700"
        >
          ← Назад к источникам
        </button>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="space-y-4">
        <p className="text-slate-500">Загрузка…</p>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const previewSrc = `${WIDGET_PREVIEW_BASE}/index.html?widgetKey=${encodeURIComponent(source.widgetKey)}&apiUrl=${encodeURIComponent(getPreviewApiUrl())}&preview=1`;

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/sources')}
        className="text-sm text-brand-600 hover:text-brand-700"
      >
        ← Назад к источникам
      </button>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">{source.name}</h1>

      <div className="mt-4 flex gap-2 border-b border-slate-200">
        {(['appearance', 'persona', 'training', 'prompt', 'general'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t
                ? 'border-b-2 border-brand-600 text-brand-600'
                : 'text-slate-500'
            }`}
          >
            {t === 'appearance'
              ? 'Внешний вид'
              : t === 'persona'
                ? 'Стиль общения'
              : t === 'training'
                ? 'Обучение агента'
                : t === 'prompt'
                  ? 'Промпт'
                  : 'Общие'}
          </button>
        ))}
      </div>

      {tab === 'training' && id ? (
        <div className="mt-6">
          <TrainingTab sourceId={id} />
        </div>
      ) : tab === 'prompt' && id ? (
        <div className="mt-6">
          <PromptTab
            sourceId={id}
            initialPrompt={config.ai?.clientPrompt ?? ''}
            onPromptChange={(prompt) => patchAi({ clientPrompt: prompt })}
          />
        </div>
      ) : tab === 'persona' ? (
        <div className="mt-6 max-w-2xl">
          <PersonaSettings
            personaStyle={config.ai?.personaStyle ?? 'friendly_pro'}
            objectionHandling={config.ai?.objectionHandling ?? 'balanced'}
            forbiddenPhrases={config.ai?.forbiddenPhrases ?? []}
            onPersonaStyleChange={(personaStyle) => patchAi({ personaStyle })}
            onObjectionHandlingChange={(objectionHandling) =>
              patchAi({ objectionHandling })
            }
            onForbiddenPhrasesChange={(forbiddenPhrases) =>
              patchAi({ forbiddenPhrases })
            }
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : saved ? 'Сохранено ✓' : 'Сохранить'}
          </button>
        </div>
      ) : (
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          {tab === 'appearance' && (
            <>
              <Field label="Основной цвет">
                <input
                  type="color"
                  value={config.appearance.primaryColor}
                  onChange={(e) => patchAppearance({ primaryColor: e.target.value })}
                  className="h-10 w-16 cursor-pointer rounded border"
                />
              </Field>
              <Field label="Позиция">
                <select
                  value={config.appearance.position}
                  onChange={(e) =>
                    patchAppearance({
                      position: e.target.value as 'bottom-right' | 'bottom-left',
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="bottom-right">Низ справа</option>
                  <option value="bottom-left">Низ слева</option>
                </select>
              </Field>
              <Field label="Форма кнопки">
                <select
                  value={config.appearance.buttonShape}
                  onChange={(e) =>
                    patchAppearance({
                      buttonShape: e.target.value as 'round' | 'square',
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="round">Круглая</option>
                  <option value="square">Квадратная</option>
                </select>
              </Field>
              <Field label="Имя менеджера">
                <input
                  value={config.personalization.managerName}
                  onChange={(e) =>
                    patchPersonalization({ managerName: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Приветствие">
                <textarea
                  value={config.personalization.welcomeMessage}
                  onChange={(e) =>
                    patchPersonalization({ welcomeMessage: e.target.value })
                  }
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Быстрые ответы">
                <div className="space-y-2">
                  {(config.behavior.quickReplies ?? []).map((reply, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        value={reply}
                        onChange={(e) => updateQuickReply(index, e.target.value)}
                        placeholder="Например: Какие тарифы?"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeQuickReply(index)}
                        className="rounded-lg border border-red-200 px-3 text-sm text-red-600 hover:bg-red-50"
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addQuickReply}
                    className="text-sm text-brand-600 hover:text-brand-700"
                  >
                    + Добавить быстрый ответ
                  </button>
                </div>
              </Field>
            </>
          )}
          {tab === 'general' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Widget key: <code className="text-xs">{source.widgetKey}</code>
              </p>

              <Field label="Сбор лидов в чате">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={config.ai?.leadExtraction?.enabled !== false}
                    onChange={(e) =>
                      patchAi({
                        leadExtraction: {
                          ...config.ai?.leadExtraction,
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                  Агент собирает контакты и создаёт лиды
                </label>
              </Field>

              <Field label="Какие данные собирать">
                <select
                  value={config.ai?.leadExtraction?.profileMode ?? 'phone'}
                  onChange={(e) =>
                    patchAi({
                      leadExtraction: {
                        ...config.ai?.leadExtraction,
                        enabled: config.ai?.leadExtraction?.enabled !== false,
                        profileMode: e.target.value as LeadProfileMode,
                      },
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="phone">Только телефон</option>
                  <option value="phone_name">Телефон + имя</option>
                  <option value="phone_name_surname">Телефон + имя + фамилия</option>
                  <option value="phone_name_surname_email">
                    Телефон + имя + фамилия + email
                  </option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Агент будет мягко запрашивать недостающие поля в диалоге
                </p>
              </Field>

              <Field label="Защита от спама (сообщений в минуту)">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="number"
                    min={3}
                    max={60}
                    placeholder="На посетителя (8)"
                    value={config.security?.rateLimitPerMinute ?? ''}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        security: {
                          ...c.security,
                          rateLimitPerMinute: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        },
                      }))
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={10}
                    max={200}
                    placeholder="На IP (40)"
                    value={config.security?.ipRateLimitPerMinute ?? ''}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        security: {
                          ...c.security,
                          ipRateLimitPerMinute: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        },
                      }))
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </Field>
            </div>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : saved ? 'Сохранено ✓' : 'Сохранить'}
          </button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Превью</p>
          <div className="relative h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            {!previewLoaded && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100">
                <SkeletonCard />
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={previewSrc}
              title="Widget preview"
              sandbox="allow-scripts allow-same-origin allow-forms"
              onLoad={() => setPreviewLoaded(true)}
              className="h-full w-full border-0"
            />
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
