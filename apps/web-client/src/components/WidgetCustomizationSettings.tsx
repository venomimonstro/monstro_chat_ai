import type {
  LauncherAnimation,
  SourceConfig,
  WidgetPageActivationMode,
} from '@ai-consultant/shared-types';
import { LAUNCHER_ANIMATION_LABELS } from '@ai-consultant/shared-types';

interface WidgetCustomizationSettingsProps {
  appearance: SourceConfig['appearance'];
  behavior: SourceConfig['behavior'];
  onAppearanceChange: (patch: Partial<SourceConfig['appearance']>) => void;
  onBehaviorChange: (patch: Partial<SourceConfig['behavior']>) => void;
}

export function WidgetCustomizationSettings({
  appearance,
  behavior,
  onAppearanceChange,
  onBehaviorChange,
}: WidgetCustomizationSettingsProps) {
  const pageMode = behavior.pageActivation?.mode ?? 'all';
  const pagePatterns = (behavior.pageActivation?.patterns ?? []).join('\n');

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Кнопка чата на сайте</h2>
        <p className="mt-1 text-xs text-slate-500">
          Как выглядит кнопка на сайте клиента (не в превью iframe). Анимация работает на
          ПК и мобильных.
        </p>
        <div className="mt-3 space-y-3">
          <label className="block text-sm text-slate-700">
            Анимация кнопки
            <select
              value={appearance.launcherAnimation ?? 'gentle'}
              onChange={(e) =>
                onAppearanceChange({
                  launcherAnimation: e.target.value as LauncherAnimation,
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {(Object.keys(LAUNCHER_ANIMATION_LABELS) as LauncherAnimation[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {LAUNCHER_ANIMATION_LABELS[key]}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={appearance.showLauncherLabel === true}
              onChange={(e) =>
                onAppearanceChange({ showLauncherLabel: e.target.checked })
              }
            />
            Показывать подпись у кнопки
          </label>

          {appearance.showLauncherLabel && (
            <label className="block text-sm text-slate-700">
              Текст подписи
              <input
                type="text"
                value={appearance.launcherLabel ?? 'Оператор онлайн'}
                onChange={(e) =>
                  onAppearanceChange({ launcherLabel: e.target.value })
                }
                placeholder="Оператор онлайн"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={appearance.launcherOnlineIndicator !== false}
              onChange={(e) =>
                onAppearanceChange({ launcherOnlineIndicator: e.target.checked })
              }
            />
            Зелёная точка «онлайн» на кнопке
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-sm text-slate-700">
              Отступ снизу (px)
              <input
                type="number"
                min={0}
                max={120}
                value={appearance.offsetY}
                onChange={(e) =>
                  onAppearanceChange({
                    offsetY: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm text-slate-700">
              Отступ сбоку (px)
              <input
                type="number"
                min={0}
                max={120}
                value={appearance.offsetX}
                onChange={(e) =>
                  onAppearanceChange({
                    offsetX: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={appearance.hideOnMobile === true}
              onChange={(e) =>
                onAppearanceChange({ hideOnMobile: e.target.checked })
              }
            />
            Скрыть кнопку на мобильных
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Конверсия в диалог</h2>
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={behavior.defaultOpen === true}
              onChange={(e) =>
                onBehaviorChange({ defaultOpen: e.target.checked })
              }
            />
            Чат сразу раскрыт при загрузке страницы
          </label>

          <label className="block text-sm text-slate-700">
            Задержка появления кнопки (сек, 0 — сразу)
            <input
              type="number"
              min={0}
              max={120}
              value={behavior.showLauncherDelaySeconds ?? 0}
              onChange={(e) =>
                onBehaviorChange({
                  showLauncherDelaySeconds: Math.max(
                    0,
                    Number(e.target.value) || 0,
                  ),
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm text-slate-700">
            Автооткрытие через (сек, 0 — выкл.)
            <input
              type="number"
              min={0}
              max={120}
              value={behavior.autoOpenDelaySeconds ?? 0}
              onChange={(e) =>
                onBehaviorChange({
                  autoOpenDelaySeconds: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm text-slate-700">
            Автооткрытие при скролле (%, 0 — выкл.)
            <input
              type="number"
              min={0}
              max={100}
              value={behavior.autoOpenOnScrollPercent ?? 0}
              onChange={(e) =>
                onBehaviorChange({
                  autoOpenOnScrollPercent: Math.min(
                    100,
                    Math.max(0, Number(e.target.value) || 0),
                  ),
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={behavior.exitIntent === true}
              onChange={(e) => onBehaviorChange({ exitIntent: e.target.checked })}
            />
            Exit intent — открывать при попытке уйти (desktop)
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Страницы сайта</h2>
        <p className="mt-1 text-xs text-slate-500">
          Показывать виджет только там, где он нужен. Паттерны — путь URL: /pricing,
          /catalog/*, /blog/*
        </p>
        <div className="mt-3 space-y-3">
          <label className="block text-sm text-slate-700">
            Режим
            <select
              value={pageMode}
              onChange={(e) =>
                onBehaviorChange({
                  pageActivation: {
                    ...behavior.pageActivation,
                    mode: e.target.value as WidgetPageActivationMode,
                    patterns: behavior.pageActivation?.patterns ?? [],
                  },
                })
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">На всех страницах</option>
              <option value="include">Только на указанных</option>
              <option value="exclude">На всех, кроме указанных</option>
            </select>
          </label>

          {pageMode !== 'all' && (
            <label className="block text-sm text-slate-700">
              Паттерны URL (по одному на строку)
              <textarea
                rows={4}
                value={pagePatterns}
                onChange={(e) =>
                  onBehaviorChange({
                    pageActivation: {
                      mode: pageMode,
                      patterns: e.target.value
                        .split(/[\n,]+/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                  })
                }
                placeholder={'/pricing\n/catalog/*\n/contacts'}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
              />
            </label>
          )}
        </div>
      </section>
    </div>
  );
}
