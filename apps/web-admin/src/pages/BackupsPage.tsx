import { useEffect, useState } from 'react';
import type { BackupSnapshotDto } from '@ai-consultant/shared-types';
import { createBackup, fetchBackups, restoreBackup } from '../lib/api';
import { EmptyState, ErrorState, LoadingState } from '../components/UiState';

function formatBytes(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BackupsPage() {
  const [backups, setBackups] = useState<BackupSnapshotDto[]>([]);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchBackups();
      setBackups(rows);
    } catch {
      setError('Не удалось загрузить бэкапы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setCreating(true);
    try {
      await createBackup(label || undefined);
      setLabel('');
      await load();
    } finally {
      setCreating(false);
    }
  };

  const restore = async (id: string) => {
    if (!confirm('Восстановить БД из этого снапшота?')) return;
    await restoreBackup(id);
    alert('Восстановление запущено');
  };

  if (loading) return <LoadingState message="Загрузка бэкапов…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100">Точки восстановления</h1>
      <p className="mt-1 text-slate-400">Снапшоты БД перед выкаткой на прод</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <input
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Метка (опционально)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button
          type="button"
          disabled={creating}
          onClick={create}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? 'Создание…' : 'Создать сейчас'}
        </button>
      </div>

      {backups.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Нет бэкапов"
            description="Создайте первую точку восстановления перед важными изменениями."
          />
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
              <tr>
                <th className="px-4 py-3">Метка</th>
                <th className="px-4 py-3">Размер</th>
                <th className="px-4 py-3">Создан</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((item) => (
                <tr key={item.id} className="border-b border-slate-800/80 transition hover:bg-slate-900/50">
                  <td className="px-4 py-3 text-slate-100">{item.label ?? item.id}</td>
                  <td className="px-4 py-3 text-slate-300">{formatBytes(item.sizeBytes)}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(item.createdAt).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => restore(item.id)}
                      className="text-brand-400 hover:text-brand-300"
                    >
                      Восстановить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
