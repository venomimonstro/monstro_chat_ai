import { useCallback, useEffect, useState } from 'react';
import {
  fetchSprintDeploymentMatrix,
  requestRollbackToVersion,
  syncSprintUpdates,
} from '../lib/api';
import type { SprintDeploymentMatrixDto, SprintDeploymentRowDto } from '@ai-consultant/shared-types';
import { ErrorState, LoadingState } from '../components/UiState';

const deployStatusLabels: Record<string, string> = {
  active: 'Активен',
  superseded: 'Заменён',
  rolled_back: 'Откат',
  not_deployed: 'Не выкатывался',
};

const deployStatusColors: Record<string, string> = {
  active: 'bg-emerald-900/50 text-emerald-300',
  superseded: 'bg-slate-800 text-slate-400',
  rolled_back: 'bg-red-900/50 text-red-300',
  not_deployed: 'bg-slate-800/50 text-slate-500',
};

export function SprintsPage() {
  const [matrix, setMatrix] = useState<SprintDeploymentMatrixDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [rollbackMsg, setRollbackMsg] = useState<string | null>(null);
  const [pendingRollback, setPendingRollback] = useState<SprintDeploymentRowDto | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [rollingBack, setRollingBack] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchSprintDeploymentMatrix()
      .then(setMatrix)
      .catch(() => setError('Не удалось загрузить матрицу спринтов'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const syncSprints = async () => {
    setSyncMsg(null);
    try {
      const result = await syncSprintUpdates();
      setSyncMsg(
        result.created > 0
          ? `Добавлено ${result.created} спринтов из SPRINTS.md`
          : 'Новых спринтов для регистрации нет',
      );
      load();
    } catch {
      setSyncMsg('Не удалось синхронизировать спринты');
    }
  };

  const startRollback = (row: SprintDeploymentRowDto) => {
    setPendingRollback(row);
    setConfirmText('');
    setRollbackMsg(null);
  };

  const cancelRollback = () => {
    setPendingRollback(null);
    setConfirmText('');
  };

  const executeRollback = async () => {
    if (!pendingRollback) return;
    const expected = pendingRollback.version;
    if (confirmText !== 'ROLLBACK' && confirmText !== expected) {
      setRollbackMsg(`Введите ROLLBACK или ${expected} для подтверждения`);
      return;
    }

    setRollingBack(true);
    setRollbackMsg(null);
    try {
      const result = await requestRollbackToVersion(pendingRollback.version);
      setRollbackMsg(result.message);
      setPendingRollback(null);
      setConfirmText('');
      load();
    } catch {
      setRollbackMsg(`Не удалось запустить откат для v${pendingRollback.version}`);
    } finally {
      setRollingBack(false);
    }
  };

  if (loading && !matrix) return <LoadingState message="Загрузка спринтов…" />;
  if (error && !matrix) return <ErrorState message={error} onRetry={load} />;

  const rows = matrix?.rows ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Спринты на сервере</h1>
          <p className="mt-1 text-slate-400">
            Все выкатанные спринты и быстрый откат версии через host-agent
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void syncSprints()}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Синхр. из SPRINTS.md
          </button>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Обновить
          </button>
        </div>
      </div>

      {matrix && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Текущая версия</p>
            <p className="mt-1 text-xl font-semibold text-brand-400">v{matrix.currentVersion}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Активный спринт</p>
            <p className="mt-1 text-xl font-semibold text-slate-100">#{matrix.currentSprint}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Предыдущая версия</p>
            <p className="mt-1 text-xl font-semibold text-slate-300">
              {matrix.previousVersion ? `v${matrix.previousVersion}` : '—'}
            </p>
          </div>
        </div>
      )}

      {syncMsg && (
        <p className="mt-4 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
          {syncMsg}
        </p>
      )}

      {rollbackMsg && (
        <p className="mt-4 rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-sm text-amber-200">
          {rollbackMsg}
        </p>
      )}

      <div className="mt-8 overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3">Спринт</th>
              <th className="px-4 py-3">Версия</th>
              <th className="px-4 py-3">Описание</th>
              <th className="px-4 py-3">Деплой</th>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Нет завершённых спринтов в SPRINTS.md
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.sprint}
                  className={`border-t border-slate-800 ${row.isLive ? 'bg-brand-950/20' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-slate-200">
                    #{row.sprint}
                    {row.isLive && (
                      <span className="ml-2 rounded bg-brand-600/30 px-1.5 py-0.5 text-xs text-brand-300">
                        LIVE
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">v{row.version}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-400" title={row.description}>
                    {row.description}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${deployStatusColors[row.deployStatus] ?? 'bg-slate-800 text-slate-400'}`}
                    >
                      {deployStatusLabels[row.deployStatus] ?? row.deployStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {row.appliedAt
                      ? new Date(row.appliedAt).toLocaleString('ru-RU')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {row.canRollback && (
                      <button
                        type="button"
                        onClick={() => startRollback(row)}
                        className="rounded border border-amber-700/50 px-2 py-1 text-xs text-amber-300 hover:bg-amber-950/30"
                      >
                        Откатить
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pendingRollback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-100">Откат версии</h2>
            <p className="mt-2 text-sm text-slate-400">
              Сервер вернётся к спринту #{pendingRollback.sprint} (v{pendingRollback.version}).
              Host-agent выполнит <code className="text-slate-300">release-rollback.sh</code>.
            </p>
            <p className="mt-4 text-sm text-slate-300">
              Введите <strong className="text-amber-300">ROLLBACK</strong> или{' '}
              <strong className="text-amber-300">{pendingRollback.version}</strong> для подтверждения:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
              autoFocus
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelRollback}
                disabled={rollingBack}
                className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-slate-800"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void executeRollback()}
                disabled={rollingBack}
                className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {rollingBack ? 'Запуск…' : 'Откатить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
