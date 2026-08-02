'use client';

import Link from 'next/link';

const prompts = [
  'Сколько стоит подключение?',
  'Как добавить знания?',
  'Что будет, если ответа нет?',
];

export function LiveDemoSection() {
  const openDemo = () => {
    const win = window as Window & { aicw?: (...args: unknown[]) => void };
    win.aicw?.('open');
  };

  return (
    <section id="demo" className="scroll-mt-20 bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="overflow-hidden rounded-3xl border border-line-200 bg-ink-900 text-white shadow-2xl">
          <div className="grid gap-10 p-7 md:p-12 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">
                Рабочее демо
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Проверьте диалог глазами посетителя
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-slate-300">
                Откройте чат и задайте вопрос. Демо отвечает по тестовой базе знаний:
                вы увидите, как выглядит ответ, уточнение запроса и передача менеджеру.
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                {prompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={openDemo}
                    className="min-h-11 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-left text-sm text-slate-200 transition hover:border-brand-400 hover:bg-brand-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={openDemo}
                  className="min-h-12 rounded-xl bg-brand-500 px-6 py-3 font-semibold text-white transition hover:bg-brand-600"
                >
                  Открыть демо-диалог
                </button>
                <Link
                  href="/register"
                  className="min-h-12 rounded-xl border border-white/20 px-6 py-3 text-center font-medium transition hover:bg-white/10"
                >
                  Проверить на своих материалах
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white p-4 text-ink-900 shadow-xl">
              <div className="flex items-center gap-3 border-b border-line-200 pb-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 font-bold text-white">
                  M
                </span>
                <div>
                  <p className="font-semibold">Monstro Chat AI</p>
                  <p className="text-xs text-emerald-600">Демо · онлайн</p>
                </div>
              </div>
              <div className="space-y-3 py-5 text-sm">
                <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-surface-50 p-3">
                  Здравствуйте! Что хотите узнать о продукте?
                </div>
                <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-sm bg-brand-500 p-3 text-white">
                  Как чат отвечает, если информации нет?
                </div>
                <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-surface-50 p-3">
                  Он честно сообщает, что данных недостаточно, и предлагает передать
                  вопрос менеджеру вместе с контекстом разговора.
                </div>
              </div>
              <p className="border-t border-line-200 pt-3 text-xs text-ink-500">
                Это демонстрационный сценарий. В вашем чате ответы строятся по вашим
                материалам.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
