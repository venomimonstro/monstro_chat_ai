import type { SourceCloserConfig } from '@ai-consultant/shared-types';
import { DEFAULT_CLOSER_DELAYS_MINUTES } from '@ai-consultant/shared-types';

interface CloserSettingsProps {
  closer: SourceCloserConfig;
  onChange: (patch: SourceCloserConfig) => void;
}

function formatDelay(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} ${days === 1 ? 'день' : 'дня'}`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? 'час' : 'часа'}`;
  }
  return `${minutes} мин`;
}

export function CloserSettings({ closer, onChange }: CloserSettingsProps) {
  const enabled = closer.enabled !== false;
  const delays = closer.delaysMinutes?.length
    ? closer.delaysMinutes
    : [...DEFAULT_CLOSER_DELAYS_MINUTES];

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">AI-closer — автодожим</h3>
        <p className="mt-1 text-sm text-slate-600">
          Если посетитель замолчал, AI сам напишет follow-up и мягко доведёт до заявки — без
          передачи оператору.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-800">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange({ ...closer, enabled: e.target.checked })}
          className="rounded border-slate-300"
        />
        Включить автоматические follow-up
      </label>

      {enabled && (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Паузы между попытками (минуты, через запятую)
            </label>
            <input
              type="text"
              value={delays.join(', ')}
              onChange={(e) => {
                const parsed = e.target.value
                  .split(',')
                  .map((s) => parseInt(s.trim(), 10))
                  .filter((n) => Number.isFinite(n) && n > 0);
                onChange({ ...closer, delaysMinutes: parsed.length ? parsed : undefined });
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="5, 60, 1440"
            />
            <p className="mt-1 text-xs text-slate-500">
              Сейчас: {delays.map(formatDelay).join(' → ')}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Максимум попыток
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={closer.maxAttempts ?? 3}
              onChange={(e) =>
                onChange({
                  ...closer,
                  maxAttempts: Math.max(1, parseInt(e.target.value, 10) || 3),
                })
              }
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={closer.onlyIncompleteLeads !== false}
              onChange={(e) =>
                onChange({ ...closer, onlyIncompleteLeads: e.target.checked })
              }
              className="rounded border-slate-300"
            />
            Только если лид ещё не собран полностью
          </label>
        </>
      )}
    </div>
  );
}
