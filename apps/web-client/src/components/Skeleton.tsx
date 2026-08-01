export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200 ${className}`}
      aria-hidden
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="lk-card min-h-[120px] space-y-3" aria-busy="true">
      <SkeletonLine className="h-4 w-1/3" />
      <SkeletonLine className="h-8 w-1/2" />
      <SkeletonLine className="h-3 w-full" />
    </div>
  );
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="lk-card space-y-3" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
