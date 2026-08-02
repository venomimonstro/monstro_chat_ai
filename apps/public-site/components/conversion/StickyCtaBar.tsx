'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function StickyCtaBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-line-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <p className="text-xs font-medium leading-tight text-ink-700">
          Упускаете продажи без чата
        </p>
        <Link href="/register" className="btn-primary shrink-0 px-4 py-2 text-sm">
          Начать бесплатно
        </Link>
      </div>
    </div>
  );
}
