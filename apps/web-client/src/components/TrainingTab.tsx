import { useCallback, useEffect, useState } from 'react';
import type { KnowledgeDocumentDto, IndexingJobDto } from '../lib/knowledge';
import {
  connectIndexingSocket,
  excludeDocument,
  fetchDocuments,
  fetchJobs,
  startCrawl,
  uploadDocument,
  deleteDocument,
} from '../lib/knowledge';

const STATUS_LABELS: Record<string, string> = {
  pending: 'В очереди',
  processing: 'Обработка',
  completed: 'Готово',
  failed: 'Ошибка',
  excluded: 'Исключено',
  queued: 'В очереди',
  running: 'Индексация',
};

export function TrainingTab({ sourceId }: { sourceId: string }) {
  const [crawlUrl, setCrawlUrl] = useState('https://');
  const [documents, setDocuments] = useState<KnowledgeDocumentDto[]>([]);
  const [jobs, setJobs] = useState<IndexingJobDto[]>([]);
  const [activeJob, setActiveJob] = useState<IndexingJobDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const reload = useCallback(async () => {
    const [docs, jobList] = await Promise.all([
      fetchDocuments(sourceId),
      fetchJobs(sourceId),
    ]);
    setDocuments(docs);
    setJobs(jobList);
    const running =
      jobList.find((j) => j.status === 'running' || j.status === 'queued') ??
      null;
    setActiveJob(running);
  }, [sourceId]);

  useEffect(() => {
    reload().catch(() => setError('Не удалось загрузить данные'));
  }, [reload]);

  useEffect(() => {
    const disconnect = connectIndexingSocket((event) => {
      setActiveJob((prev) => {
        if (prev && prev.id !== event.jobId) return prev;
        return {
          ...(prev ?? {
            id: event.jobId,
            tenantId: event.tenantId,
            sourceId,
            type: 'crawl',
            rootUrl: null,
            errorMessage: null,
            startedAt: null,
            completedAt: null,
            createdAt: new Date().toISOString(),
          }),
          processedPages: event.processed,
          totalPages: event.total,
          status: (event.status as IndexingJobDto['status']) ?? 'running',
        };
      });
      if (event.status === 'completed' || event.status === 'failed') {
        reload().catch(() => undefined);
      }
    });
    return disconnect;
  }, [reload, sourceId]);

  const handleCrawl = async () => {
    setLoading(true);
    setError(null);
    try {
      const job = await startCrawl(sourceId, crawlUrl);
      setActiveJob(job);
      await reload();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Не удалось запустить индексацию';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setLoading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await uploadDocument(sourceId, file);
      }
      await reload();
    } catch {
      setError('Ошибка загрузки файла');
    } finally {
      setLoading(false);
    }
  };

  const progress =
    activeJob && activeJob.totalPages > 0
      ? Math.round((activeJob.processedPages / activeJob.totalPages) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Индексация сайта
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Укажите URL — агент обойдёт страницы (глубина 3) с учётом robots.txt
        </p>
        <div className="mt-3 flex gap-2">
          <input
            type="url"
            value={crawlUrl}
            onChange={(e) => setCrawlUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleCrawl}
            disabled={loading}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Индексировать
          </button>
        </div>

        {activeJob &&
          (activeJob.status === 'running' || activeJob.status === 'queued') && (
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-slate-600">
                <span>{STATUS_LABELS[activeJob.status]}</span>
                <span>
                  {activeJob.processedPages} / {activeJob.totalPages}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-brand-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

        {activeJob?.status === 'failed' && activeJob.errorMessage && (
          <p className="mt-2 text-sm text-red-600">{activeJob.errorMessage}</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Документы</h2>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`mt-3 rounded-lg border-2 border-dashed p-6 text-center text-sm ${
            dragOver
              ? 'border-brand-500 bg-brand-50'
              : 'border-slate-300 text-slate-500'
          }`}
        >
          Перетащите PDF, DOCX, TXT или CSV
          <div className="mt-2">
            <label className="cursor-pointer text-brand-600 hover:underline">
              выберите файл
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt,.csv"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          </div>
        </div>

        <ul className="mt-4 divide-y divide-slate-100">
          {documents.length === 0 && (
            <li className="py-3 text-sm text-slate-500">
              Пока нет проиндексированных страниц и файлов
            </li>
          )}
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-2 py-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800">
                  {doc.title ?? doc.url ?? 'Документ'}
                </p>
                <p className="text-xs text-slate-500">
                  {doc.type === 'site_page' ? 'Страница' : 'Файл'} ·{' '}
                  {STATUS_LABELS[doc.status] ?? doc.status}
                  {doc.errorMessage ? ` — ${doc.errorMessage}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {doc.type === 'site_page' && doc.status === 'completed' && (
                  <button
                    type="button"
                    onClick={() =>
                      excludeDocument(doc.id).then(reload).catch(() => undefined)
                    }
                    className="text-xs text-amber-600 hover:underline"
                  >
                    Исключить
                  </button>
                )}
                {doc.type === 'file' && (
                  <button
                    type="button"
                    onClick={() =>
                      deleteDocument(doc.id).then(reload).catch(() => undefined)
                    }
                    className="text-xs text-red-600 hover:underline"
                  >
                    Удалить
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {jobs.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            История индексации
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {jobs.map((job) => (
              <li key={job.id}>
                {job.rootUrl ?? 'Загрузка файла'} —{' '}
                {STATUS_LABELS[job.status] ?? job.status} ({job.processedPages}/
                {job.totalPages})
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
