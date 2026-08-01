import { useEffect, useState } from 'react';
import type { SystemUpdateDto } from '@ai-consultant/shared-types';
import {
  approveUpdate,
  createSystemUpdate,
  fetchSystemUpdate,
  fetchSystemUpdates,
  startUpdateTest,
} from '../lib/api';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/UiState';

const statusLabels: Record<string, string> = {
  pending: 'Ожидает',
  testing: 'Тестируется',
  test_passed: 'Тест пройден',
  test_failed: 'Тест провален',
  awaiting_approval: 'Ожидает выкатки',
  deploying: 'Деплой',
  canary_monitoring: 'Canary',
  applied: 'Применено',
  rolled_back: 'Откат',
};

const statusColors: Record<string, string> = {
  pending: 'bg-slate-800 text-slate-300',
  testing: 'bg-blue-900/50 text-blue-300',
  test_passed: 'bg-emerald-900/50 text-emerald-300',
  test_failed: 'bg-red-900/50 text-red-300',
  awaiting_approval: 'bg-amber-900/50 text-amber-300',
  deploying: 'bg-purple-900/50 text-purple-300',
  canary_monitoring: 'bg-cyan-900/50 text-cyan-300',
  applied: 'bg-emerald-900/50 text-emerald-300',
  rolled_back: 'bg-red-900/50 text-red-300',
};

export function UpdatesPage() {
  const [updates, setUpdates] = useState<SystemUpdateDto[]>([]);
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<SystemUpdateDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchSystemUpdates();
      setUpdates(rows);
    } catch {
      setError('Не удалось загрузить обновления');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const timer = setInterval(() => {
      fetchSystemUpdate(activeId).then(setActiveDetail);
    }, 2000);
    fetchSystemUpdate(activeId).then(setActiveDetail);
    return () => clearInterval(timer);
  }, [activeId]);

  const register = async () => {
    if (!version.trim()) return;
    await createSystemUpdate({ version: version.trim(), changelog });
    setVersion('');
    setChangelog('');
    await load();
  };

  const runTest = async (id: string) => {
    setActiveId(id);
    await startUpdateTest(id);
    await load();
  };

  const approve = async (id: string) => {
    setActiveId(id);
    await approveUpdate(id);
    await load();
  };

  if (loading) return <LoadingState message="Загрузка обновлений…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100">Обновления системы</h1>
      <p className="mt-1 text-slate-400">
        Staging-тесты, blue-green деплой и canary-мониторинг
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Версия (напр. 0.2.0)"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        />
        <input
          className="min-w-[240px] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Changelog"
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
        />
        <button
          type="button"
          onClick={register}
          disabled={!version.trim()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Зарегистрировать версию
        </button>
      </div>

      {updates.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Нет обновлений"
            description="Зарегистрируйте первую версию, чтобы начать тестирование и выкатку."
          />
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {updates.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-100">{item.version}</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                    <StatusBadge status={item.status} labels={statusLabels} colors={statusColors} />
                    {item.imageTag ? `· ${item.imageTag}` : ''}
                  </p>
                  {item.changelog && (
                    <p className="mt-1 text-sm text-slate-500">{item.changelog}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {['pending', 'test_failed'].includes(item.status) && (
                    <button
                      type="button"
                      onClick={() => runTest(item.id)}
                      className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                    >
                      Запустить тестирование
                    </button>
                  )}
                  {item.status === 'test_passed' && (
                    <button
                      type="button"
                      onClick={() => approve(item.id)}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      Разрешить выкатку на прод
                    </button>
                  )}
                </div>
              </div>

              {item.testReport && (
                <p className="mt-3 text-sm text-slate-400">
                  Тесты: {item.testReport.passed ? '✅ пройдены' : '❌ провалены'}
                  {item.testReport.error ? ` — ${item.testReport.error}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {activeDetail && (
        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-950 p-4">
          <h2 className="font-medium text-slate-200">
            Live-лог: {activeDetail.version}
          </h2>
          <pre className="mt-3 max-h-64 overflow-auto text-xs text-slate-300">
            {activeDetail.deployLog.map((line) => `[${line.level}] ${line.message}`).join('\n') ||
              'Ожидание логов…'}
          </pre>
          {activeDetail.canaryMetrics && (
            <p className="mt-2 text-sm text-amber-300">
              Canary: errorRate={activeDetail.canaryMetrics.errorRate}, p95=
              {activeDetail.canaryMetrics.latencyP95Ms}ms —{' '}
              {activeDetail.canaryMetrics.passed ? 'OK' : 'ROLLBACK'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
