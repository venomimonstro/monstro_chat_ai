import { useEffect, useState } from 'react';
import { fetchSprints } from '../lib/api';
import type { SprintInfoDto } from '@ai-consultant/shared-types';
import { EmptyState, ErrorState, LoadingState } from '../components/UiState';

export function SprintsPage() {
  const [sprints, setSprints] = useState<SprintInfoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchSprints()
      .then(setSprints)
      .catch(() => setError('Не удалось загрузить спринты'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingState message="Загрузка спринтов…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100">Спринты</h1>
      <p className="mt-1 text-slate-400">
        История разработки из docs/SPRINTS.md
      </p>

      {sprints.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="Спринты не найдены" />
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-slate-800">
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
                  <td className="px-4 py-3 font-medium text-slate-100">
                    Sprint {sprint.number}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        sprint.status === 'Done'
                          ? 'bg-emerald-900/50 text-emerald-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {sprint.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{sprint.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
