import { useEffect, useState } from 'react';
import type { PromptDto, PromptExperimentDto } from '@ai-consultant/shared-types';
import {
  createPromptExperiment,
  fetchPromptExperimentReport,
  fetchPromptExperiments,
  pausePromptExperiment,
  startPromptExperiment,
} from '../lib/prompts';
import { extractErrorMessage } from '../lib/errors';
import { showToast } from './Toast';

export function PromptAbTestSection({ history }: { history: PromptDto[] }) {
  const [experiments, setExperiments] = useState<PromptExperimentDto[]>([]);
  const [name, setName] = useState('');
  const [promptAId, setPromptAId] = useState('');
  const [promptBId, setPromptBId] = useState('');
  const [trafficB, setTrafficB] = useState(50);
  const [reportId, setReportId] = useState<string | null>(null);
  const [report, setReport] = useState<Awaited<ReturnType<typeof fetchPromptExperimentReport>> | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setExperiments(await fetchPromptExperiments());
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || !promptAId || !promptBId) return;
    setLoading(true);
    try {
      await createPromptExperiment({
        name: name.trim(),
        promptAId,
        promptBId,
        trafficBPercent: trafficB,
      });
      setName('');
      showToast('Эксперимент создан', 'success');
      await load();
    } catch (err: unknown) {
      showToast(extractErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async (id: string) => {
    setReportId(id);
    setReport(await fetchPromptExperimentReport(id, 7));
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">A/B тест промптов</h2>
      <p className="mt-1 text-xs text-slate-500">
        Сравните конверсию диалог → лид для двух версий промпта
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className="lk-input"
          placeholder="Название эксперимента"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="number"
          min={1}
          max={99}
          className="lk-input"
          value={trafficB}
          onChange={(e) => setTrafficB(Number(e.target.value))}
          title="% трафика на вариант B"
        />
        <select className="lk-input" value={promptAId} onChange={(e) => setPromptAId(e.target.value)}>
          <option value="">Вариант A</option>
          {history.map((p) => (
            <option key={p.id} value={p.id}>
              v{p.version}
            </option>
          ))}
        </select>
        <select className="lk-input" value={promptBId} onChange={(e) => setPromptBId(e.target.value)}>
          <option value="">Вариант B</option>
          {history.map((p) => (
            <option key={p.id} value={p.id}>
              v{p.version}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={() => void handleCreate()}
        className="lk-btn-primary mt-3"
      >
        Создать эксперимент
      </button>

      {experiments.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 text-sm">
          {experiments.map((exp) => (
            <li key={exp.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="font-medium">{exp.name}</p>
                <p className="text-xs text-slate-500">
                  {exp.status} · B={exp.trafficBPercent}%
                </p>
              </div>
              <div className="flex gap-2">
                {exp.status !== 'running' ? (
                  <button
                    type="button"
                    className="text-brand-600 hover:underline"
                    onClick={() => void startPromptExperiment(exp.id).then(load)}
                  >
                    Запустить
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-amber-600 hover:underline"
                    onClick={() => void pausePromptExperiment(exp.id).then(load)}
                  >
                    Пауза
                  </button>
                )}
                <button
                  type="button"
                  className="text-slate-600 hover:underline"
                  onClick={() => void loadReport(exp.id)}
                >
                  Отчёт 7д
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {report && reportId && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-medium">{report.name}</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            <div>
              <p className="text-slate-600">Вариант A</p>
              <p>
                {report.variantA.dialogs} диалогов · {report.variantA.leads} лидов ·{' '}
                {report.variantA.conversionRate}%
              </p>
            </div>
            <div>
              <p className="text-slate-600">Вариант B</p>
              <p>
                {report.variantB.dialogs} диалогов · {report.variantB.leads} лидов ·{' '}
                {report.variantB.conversionRate}%
              </p>
            </div>
          </div>
          {!report.sampleSizeReached && (
            <p className="mt-2 text-xs text-amber-600">
              Минимальная выборка ({report.minSampleSize}) ещё не достигнута
            </p>
          )}
        </div>
      )}
    </section>
  );
}
