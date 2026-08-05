/** CSS-only chat preview — RedFlow, light + red */
export function ChatMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden>
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand-200/40 to-brand-500/10 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-line-200 bg-white shadow-2xl shadow-slate-900/8">
        <div className="flex items-center gap-2 border-b border-line-200 bg-surface-50 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="mx-auto flex h-6 flex-1 max-w-[200px] items-center justify-center rounded-md bg-white px-3 text-[10px] text-ink-500">
            ваш-сайт.ru
          </div>
        </div>

        <div className="bg-gradient-to-b from-surface-50 to-white px-5 py-6">
          <div className="h-3 w-24 rounded bg-line-200" />
          <div className="mt-4 h-4 w-3/4 rounded bg-line-200" />
          <div className="mt-2 h-4 w-1/2 rounded bg-surface-50" />
        </div>

        <div className="absolute bottom-4 right-4 w-[min(280px,calc(100%-2rem))] overflow-hidden rounded-xl border border-line-200 bg-white shadow-xl">
          <div className="flex items-center gap-2.5 bg-brand-500 px-3 py-2.5">
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/20">
              <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white">
                M
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-brand-500 bg-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">RedFlow</p>
              <p className="text-[11px] text-brand-100">Онлайн · отвечает мгновенно</p>
            </div>
          </div>
          <div className="space-y-2.5 bg-surface-50 p-3">
            <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-xs leading-relaxed text-ink-700 shadow-sm">
              Здравствуйте! Помогу с записью и ответами. Что вас интересует?
            </div>
            <div className="ml-auto max-w-[75%] rounded-2xl rounded-tr-sm bg-brand-500 px-3 py-2 text-xs text-white">
              Можно записаться на завтра?
            </div>
            <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-xs leading-relaxed text-ink-700 shadow-sm">
              Конечно! Оставьте телефон — менеджер подтвердит запись ✓
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-line-200 bg-white px-2.5 py-2">
            <div className="flex-1 rounded-full bg-surface-50 px-3 py-1.5 text-[11px] text-ink-500">
              Напишите сообщение…
            </div>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500">
              <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -left-2 top-1/3 hidden animate-float rounded-xl border border-white bg-white px-3 py-2 shadow-lg md:block">
        <p className="text-xs font-semibold text-ink-900">Лиды 24/7</p>
        <p className="text-[10px] text-ink-500">бесплатно на триале</p>
      </div>
    </div>
  );
}
