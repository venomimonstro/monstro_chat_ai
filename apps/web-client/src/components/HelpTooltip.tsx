export function HelpTooltip({
  text,
  href,
}: {
  text: string;
  href?: string;
}) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 hover:bg-brand-100 hover:text-brand-700"
        aria-label="Подсказка"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block group-focus-within:block"
      >
        {text}
        {href ? (
          <>
            {' '}
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="pointer-events-auto underline"
            >
              Подробнее
            </a>
          </>
        ) : null}
      </span>
    </span>
  );
}
