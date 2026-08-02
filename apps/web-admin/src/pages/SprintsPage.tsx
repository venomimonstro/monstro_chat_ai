import { useEffect, useState } from 'react';
import {
  fetchDeploymentRecords,
  fetchSprints,
  requestRollbackToVersion,
} from '../lib/api';
import type { DeploymentRecordDto, SprintInfoDto } from '@ai-consultant/shared-types';
import { EmptyState, ErrorState, LoadingState } from '../components/UiState';

const deployStatusLabels: Record<string, string> = {
  active: 'Активен',
  superseded: 'Заменён',
  rolled_back: 'Откат',
};

export function SprintsPage() {
  const [sprints, setSprints] = useState<SprintInfoDto[]>([]);
  const [deployments, setDeployments] = useState<DeploymentRecordDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollbackMsg, setRollbackMsg] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchSprints(), fetchDeploymentRecords()])
      .then(([sprintRows, deployRows]) => {
        setSprints(sprintRows);
        setDeployments(deployRows);
      })
      .catch(() => setError('Не удалось загрузить спринты'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const rollback = async (version: string) => {
    setRollbackMsg(null);
    try {
      const result = await requestRollbackToVersion(version);
      setRollbackMsg(result.message);
      if (result.command) {
        await navigator.clipboard.writeText(result.command).catch(() => undefined);
      }
    } catch {
      setRollbackMsg(`Не удалось подготовить откат для ${version}`);
    }
  };

  if (loading) return <LoadingState message="Загрузка спринтов…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100">Спринты и деплои</h1>
      <p className="mt-1 text-slate-400">
        История спринтов и выкатанных версий на сервере
      </p>

      {rollbackMsg && (
        <p className="mt-4 rounded-lg border border-amber-800/50 bg-amber-950/20 px-3 py-2 text-sm text-amber-200">
          {rollbackMsg}
        </p>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-100">История деплоев</h2>
        {deployments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            Деплои появятся после первого выката через deploy-latest.sh
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Версия</th>
                  <th className="px-4 py-3">Спринт</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Дата</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {deployments.map((d) => (
                  <tr key={d.id} className="border-t border-slate-800">
                    <td className="px-4 py-3 font-medium text-slate-200">v{d.version}</td>
                    <td className="px-4 py-3 text-slate-300">{d.sprint}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {deployStatusLabels[d.status] ?? d.status}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(d.appliedAt).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-4 py-3">
                      {d.status !== 'rolled_back' && (
                        <button
                          type="button"
                          onClick={() => rollback(d.version)}
                          className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          Откатить
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sprints.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Спринты не найдены" />
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-slate-800">
          <h2 className="border-b border-slate-800 bg-slate-900 px-4 py-3 text-lg font-semibold text-slate-100">
            План спринтов
          </h2>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Описание</th>
              </tr>
            </thead>
            <tbody>
              {sprints.map((sprint) => (
                <tr key={sprint.number} className="border-t border-slate-800">
                  <td className="px-4 py-3 font-medium text-slate-200">
                    {sprint.number}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{sprint.status}</td>
                  <td className="px-4 py-3 text-slate-400">{sprint.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
