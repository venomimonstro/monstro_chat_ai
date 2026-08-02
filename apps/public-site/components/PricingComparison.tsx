const rows = [
  {
    label: 'Модель оплаты',
    competitors: 'За каждый лид / заявку',
    us: 'За сообщения и токены',
    usWin: true,
  },
  {
    label: 'Стоимость при 500 диалогах',
    competitors: 'от 50 000 ₽/мес',
    us: 'от 2 990 ₽/мес',
    usWin: true,
  },
  {
    label: 'Платите за «пустые» заявки',
    competitors: 'Да — лид = деньги',
    us: 'Нет — только реальные ответы AI',
    usWin: true,
  },
  {
    label: 'Прозрачность расходов',
    competitors: 'Сложно прогнозировать',
    us: 'Лимиты и баланс в ЛК',
    usWin: true,
  },
  {
    label: 'Обучение на вашем сайте',
    competitors: 'Есть',
    us: 'RAG + документы за 5 мин',
    usWin: false,
  },
  {
    label: 'CRM: amoCRM, Битрикс24',
    competitors: 'Частично',
    us: 'Из коробки',
    usWin: true,
  },
];

export function PricingComparison() {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="grid grid-cols-3 border-b border-slate-100 bg-slate-50 text-sm font-semibold">
        <div className="px-4 py-4 text-slate-500 md:px-6">Критерий</div>
        <div className="border-l border-slate-100 px-4 py-4 text-center text-slate-500 md:px-6">
          Конкуренты
          <span className="mt-0.5 block text-xs font-normal text-slate-400">оплата за лиды</span>
        </div>
        <div className="border-l border-brand-100 bg-brand-50 px-4 py-4 text-center text-brand-800 md:px-6">
          AI-Консультант
          <span className="mt-0.5 block text-xs font-normal text-brand-600">оплата за сообщения</span>
        </div>
      </div>
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-3 border-b border-slate-50 last:border-0 text-sm"
        >
          <div className="px-4 py-3.5 font-medium text-slate-700 md:px-6">{row.label}</div>
          <div className="border-l border-slate-50 px-4 py-3.5 text-center text-slate-500 md:px-6">
            {row.competitors}
          </div>
          <div
            className={`border-l border-brand-50 px-4 py-3.5 text-center md:px-6 ${
              row.usWin ? 'bg-brand-50/50 font-medium text-brand-800' : 'text-slate-600'
            }`}
          >
            {row.usWin && (
              <span className="mr-1 inline-block text-brand-500" aria-hidden>
                ✓
              </span>
            )}
            {row.us}
          </div>
        </div>
      ))}
    </div>
  );
}
