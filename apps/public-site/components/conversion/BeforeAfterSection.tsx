const pairs = [
  { before: 'Посетитель не находит ответ — и уходит', after: 'Мгновенный ответ — клиент остаётся и покупает' },
  { before: 'Заявки только в рабочие часы', after: 'Продажи круглосуточно, включая ночь и выходные' },
  { before: 'Менеджеры тонут в однотипных вопросах', after: 'ИИ закрывает рутину — люди работают с горячими лидами' },
  { before: 'Не видно, почему клиенты уходят', after: 'Все диалоги в одном месте — понятно, что мешает продажам' },
  { before: 'Каждый ушедший — потерянные деньги', after: 'Каждый посетитель получает шанс стать покупателем' },
];

export function BeforeAfterSection() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line-200 bg-white shadow-card">
      <div className="grid md:grid-cols-2">
        <div className="border-b border-line-200 bg-surface-50 px-6 py-4 md:border-b-0 md:border-r">
          <p className="text-sm font-semibold uppercase tracking-wide text-ink-500">
            Сайт без чата
          </p>
        </div>
        <div className="bg-brand-50 px-6 py-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
            С Monstro Chat AI
          </p>
        </div>
      </div>
      {pairs.map((row, i) => (
        <div
          key={row.before}
          className={`grid md:grid-cols-2 ${i < pairs.length - 1 ? 'border-b border-line-200' : ''}`}
        >
          <div className="flex gap-3 border-b border-line-200 px-6 py-4 text-sm text-ink-700 md:border-b-0 md:border-r">
            <span className="text-red-400" aria-hidden>
              ✕
            </span>
            {row.before}
          </div>
          <div className="flex gap-3 px-6 py-4 text-sm font-medium text-ink-900">
            <span className="text-brand-500" aria-hidden>
              ✓
            </span>
            {row.after}
          </div>
        </div>
      ))}
    </div>
  );
}
