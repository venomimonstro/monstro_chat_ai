import Link from 'next/link';

const items = [
  {
    q: 'Дорого?',
    a: 'Одна-две дополнительные сделки в месяц уже окупают RedFlow. Начните бесплатно и посчитайте на своих цифрах.',
  },
  {
    q: 'Сложно подключить?',
    a: '15 минут и одна строчка кода на сайт. Без программистов. Поможем настроить бесплатно, если что-то непонятно.',
  },
  {
    q: 'Не заменит менеджера?',
    a: 'И не должен. ИИ берёт рутину и мгновенные ответы, менеджеры — только горячих клиентов. Команда продаёт больше, не работая больше.',
  },
  {
    q: 'А если не сработает?',
    a: 'Начните бесплатно, протестируйте на реальных клиентах. Не увидите результат — отключите. Без карты и обязательств.',
  },
];

export function ObjectionsSection() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.q} className="card">
          <h3 className="text-lg font-semibold text-ink-900">{item.q}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">{item.a}</p>
        </div>
      ))}
      <div className="card flex flex-col justify-center bg-brand-500 text-white sm:col-span-2 md:col-span-1">
        <p className="font-semibold">Готовы проверить на своём сайте?</p>
        <Link
          href="/register"
          className="mt-4 inline-flex justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-50"
        >
          Начать бесплатно
        </Link>
      </div>
    </div>
  );
}
