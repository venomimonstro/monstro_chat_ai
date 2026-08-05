import { useCallback, useEffect, useState } from 'react';
import type {
  PromptRegressionCaseDto,
  PromptRegressionRunDto,
} from '@ai-consultant/shared-types';
import {
  createRegressionCase,
  deleteRegressionCase,
  fetchRegressionCases,
  fetchRegressionRuns,
  runPromptRegression,
  updateRegressionCase,
} from '../lib/prompts';

export function PromptRegressionSection({
  sourceId,
  clientPrompt,
}: {
  sourceId: string;
  clientPrompt: string;
}) {
  const [cases, setCases] = useState<PromptRegressionCaseDto[]>([]);
  const [runs, setRuns] = useState<PromptRegressionRunDto[]>([]);
  const [name, setName] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [mustContain, setMustContain] = useState('');
  const [mustNotContain, setMustNotContain] = useState('');
  const [minLength, setMinLength] = useState('');
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<PromptRegressionRunDto | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [caseList, runList] = await Promise.all([
        fetchRegressionCases(sourceId),
        fetchRegressionRuns(5),
      ]);
      setCases(caseList);
      setRuns(runList);
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    reload().catch(() => undefined);
  }, [reload]);

  const handleCreate = async () => {
    if (!name.trim() || !userMessage.trim()) return;
    await createRegressionCase({
      name: name.trim(),
      userMessage: userMessage.trim(),
      sourceId,
      assertions: {
        mustContain: mustContain
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        mustNotContain: mustNotContain
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        minLength: minLength ? parseInt(minLength, 10) : undefined,
      },
    });
    setName('');
    setUserMessage('');
    setMustContain('');
    setMustNotContain('');
    setMinLength('');
    await reload();
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await runPromptRegression({
        sourceId,
        clientPrompt,
      });
      setLastRun(result);
      await reload();
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Regression-тесты промпта
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Автоматическая проверка ответов на типовые вопросы
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleRun().catch(() => undefined)}
          disabled={running || cases.filter((c) => c.isActive).length === 0}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {running ? 'Запуск…' : 'Запустить все'}
        </button>
      </div>

      {lastRun && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          <p>
            Последний прогон:{' '}
            <span className="font-medium text-green-700">{lastRun.passed} ✓</span>
            {' · '}
            <span className="font-medium text-red-600">{lastRun.failed} ✗</span>
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {lastRun.results.map((r) => (
              <li key={r.caseId} className={r.passed ? 'text-green-700' : 'text-red-600'}>
                {r.passed ? '✓' : '✗'} {r.caseName}
                {!r.passed && r.failures.length > 0 && (
                  <span className="text-slate-600"> — {r.failures.join('; ')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название кейса"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          placeholder="Тестовое сообщение пользователя"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          value={mustContain}
          onChange={(e) => setMustContain(e.target.value)}
          placeholder="Должен содержать (через запятую)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={mustNotContain}
          onChange={(e) => setMustNotContain(e.target.value)}
          placeholder="Не должен содержать (через запятую)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={minLength}
          onChange={(e) => setMinLength(e.target.value)}
          placeholder="Мин. длина ответа"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => handleCreate().catch(() => undefined)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Добавить кейс
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Загрузка кейсов…</p>
      ) : cases.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Кейсов пока нет</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 text-sm">
          {cases.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 py-2">
              <div>
                <p className="font-medium text-slate-900">
                  {c.name}
                  {!c.isActive && (
                    <span className="ml-2 text-xs text-slate-400">выкл</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{c.userMessage}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateRegressionCase(c.id, { isActive: !c.isActive })
                      .then(reload)
                      .catch(() => undefined)
                  }
                  className="text-xs text-brand-600 hover:underline"
                >
                  {c.isActive ? 'Выкл' : 'Вкл'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    deleteRegressionCase(c.id).then(reload).catch(() => undefined)
                  }
                  className="text-xs text-red-600 hover:underline"
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {runs.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-xs font-medium text-slate-500">История прогонов</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {runs.map((run) => (
              <li key={run.id}>
                {new Date(run.createdAt).toLocaleString('ru-RU')} — {run.passed}/
                {run.passed + run.failed} пройдено
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
