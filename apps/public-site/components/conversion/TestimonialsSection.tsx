const items = [
  {
    quote:
      'Установили чат за один вечер, на следующий день — 12 заявок вместо привычных 3. Окупился в первую неделю.',
    name: 'Андрей С.',
    role: 'Владелец интернет-магазина',
  },
  {
    quote:
      'Перестали терять клиентов по ночам. ИИ отвечает сам, менеджеры подключаются, когда клиент готов платить.',
    name: 'Марина Л.',
    role: 'Руководитель продаж, онлайн-школа',
  },
  {
    quote:
      'Продажи выросли примерно на четверть за первый месяц. Клиенты пишут, что им наконец удобно и быстро отвечают.',
    name: 'Игорь П.',
    role: 'Основатель студии ремонта',
  },
];

export function TestimonialsSection() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {items.map((t) => (
        <blockquote key={t.name} className="card card-hover flex flex-col">
          <div className="mb-4 flex gap-0.5 text-brand-400" aria-label="5 из 5">
            {'★★★★★'}
          </div>
          <p className="flex-1 text-sm leading-relaxed text-ink-700">&ldquo;{t.quote}&rdquo;</p>
          <footer className="mt-4 border-t border-line-200 pt-4">
            <p className="font-semibold text-ink-900">{t.name}</p>
            <p className="text-xs text-ink-500">{t.role}</p>
          </footer>
        </blockquote>
      ))}
    </div>
  );
}
