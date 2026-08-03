const stats = [
  { value: '24/7', label: 'Ответы без выходных' },
  { value: '7 дней', label: 'Бесплатный тест' },
  { value: '15 мин', label: 'Подключение на сайт' },
  { value: '+35%', label: 'Больше обращений*' },
];

export function SocialProofBar() {
  return (
    <section className="border-y border-line-200 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-2xl font-extrabold text-brand-600 md:text-3xl">{stat.value}</p>
            <p className="mt-1 text-xs text-ink-500 sm:text-sm">{stat.label}</p>
          </div>
        ))}
      </div>
      <p className="pb-4 text-center text-[10px] text-ink-400">
        * Средний рост обращений у клиентов в первый месяц после запуска чата
      </p>
    </section>
  );
}
