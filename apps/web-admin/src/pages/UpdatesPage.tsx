import { useEffect, useState } from 'react';
import type { ReleaseDeployInstructionsDto, SystemUpdateDto } from '@ai-consultant/shared-types';
import {
  approveUpdate,
  createSystemUpdate,
  fetchCurrentRelease,
  fetchDeployInstructions,
  fetchSystemUpdate,
  fetchSystemUpdates,
  rollbackUpdate,
  startUpdateTest,
} from '../lib/api';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/UiState';

const statusLabels: Record<string, string> = {
  pending: 'Ожидает',
  testing: 'Тестируется',
  test_passed: 'Тест пройден',
  test_failed: 'Тест провален',
  awaiting_approval: 'Одобрено — ждёт деплоя',
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
  const [currentRelease, setCurrentRelease] = useState<{
    version: string;
    sprint: number;
  } | null>(null);
  const [version, setVersion] = useState('');
  const [sprintNumber, setSprintNumber] = useState('');
  const [changelog, setChangelog] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<SystemUpdateDto | null>(null);
  const [deployInstr, setDeployInstr] = useState<ReleaseDeployInstructionsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, release] = await Promise.all([
        fetchSystemUpdates(),
        fetchCurrentRelease(),
      ]);
      setUpdates(rows);
      setCurrentRelease({ version: release.version, sprint: release.sprint });
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

  useEffect(() => {
    if (!activeDetail || activeDetail.status !== 'awaiting_approval') {
      setDeployInstr(null);
      return;
    }
    fetchDeployInstructions(activeDetail.id).then(setDeployInstr);
  }, [activeDetail?.id, activeDetail?.status]);

  const register = async () => {
    if (!version.trim()) return;
    await createSystemUpdate({
      version: version.trim(),
      sprintNumber: sprintNumber ? Number(sprintNumber) : undefined,
      changelog,
    });
    setVersion('');
    setSprintNumber('');
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

  const rollback = async (id: string, rollbackVersion?: string | null) => {
    setActiveId(id);
    await rollbackUpdate(id, rollbackVersion ?? undefined);
    await load();
  };

  if (loading) return <LoadingState message="Загрузка обновлений…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100">Обновления системы</h1>
      <p className="mt-1 text-slate-400">
        Версионирование, проверки, деплой и откат
      </p>

      {currentRelease && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            Текущая версия:{' '}
            <span className="font-semibold text-brand-400">
              v{currentRelease.version}
            </span>{' '}
            · Sprint {currentRelease.sprint}
          </div>
          <div className="rounded-xl border border-brand-500/40 bg-brand-950/20 px-4 py-3 text-sm">
            <p className="font-medium text-brand-300">Рекомендуемая команда деплоя</p>
            <p className="mt-1 text-slate-400">
              Автоматически берёт последний спринт из SPRINTS.md — не нужно вводить версию вручную
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-200">
              sudo bash /opt/monstro_chat_ai/scripts/deploy-latest.sh
            </pre>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          placeholder="Спринт"
          type="number"
          value={sprintNumber}
          onChange={(e) => {
            setSprintNumber(e.target.value);
            if (e.target.value) {
              setVersion(`0.${e.target.value}.0`);
            }
          }}
        />
        <input
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Версия (0.33.0)"
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
          Зарегистрировать релиз
        </button>
      </div>

      {updates.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Нет обновлений"
            description="Зарегистрируйте релиз с номером спринта и версией."
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
                  <p className="font-semibold text-slate-100">
                    v{item.version}
                    {item.sprintNumber != null && (
                      <span className="ml-2 text-sm font-normal text-slate-400">
                        Sprint {item.sprintNumber}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                    <StatusBadge status={item.status} labels={statusLabels} colors={statusColors} />
                    {item.rollbackVersion && (
                      <span>· откат → {item.rollbackVersion}</span>
                    )}
                  </p>
                  {item.changelog && (
                    <p className="mt-1 text-sm text-slate-500">{item.changelog}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {['pending', 'test_failed'].includes(item.status) && (
                    <button
                      type="button"
                      onClick={() => runTest(item.id)}
                      className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                    >
                      Проверить (staging)
                    </button>
                  )}
                  {item.status === 'test_passed' && (
                    <button
                      type="button"
                      onClick={() => approve(item.id)}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      Одобрить выкатку
                    </button>
                  )}
                  {['applied', 'deploying', 'canary_monitoring'].includes(item.status) && (
                    <button
                      type="button"
                      onClick={() => rollback(item.id, item.rollbackVersion)}
                      className="rounded-lg border border-red-700 px-3 py-2 text-sm text-red-300 hover:bg-red-950/30"
                    >
                      Откатить
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

      {deployInstr && (
        <div className="mt-8 rounded-xl border border-amber-800/50 bg-amber-950/20 p-4">
          <h2 className="font-medium text-amber-200">Команда деплоя на сервере</h2>
          {deployInstr.isStale && deployInstr.warning && (
            <p className="mt-2 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {deployInstr.warning}
            </p>
          )}
          <p className="mt-3 text-sm font-medium text-emerald-300">✓ Используйте эту команду:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-emerald-100">
            {deployInstr.recommendedCommand}
          </pre>
          <p className="mt-4 text-sm text-amber-100/60">
            Команда для конкретного релиза (только если версия совпадает с текущей на сервере v
            {deployInstr.currentVersion}):
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-400">
            {deployInstr.command}
          </pre>
          <p className="mt-4 text-sm text-amber-100/80">Откат:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-200">
            {deployInstr.rollbackCommand}
          </pre>
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
        </div>
      )}
    </div>
  );
}
