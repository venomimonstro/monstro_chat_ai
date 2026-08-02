'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function StickyCtaBar() {
  const [visible, setVisible] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    const onOpen = () => setChatOpen(true);
    const onClose = () => setChatOpen(false);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('aicw:opened', onOpen);
    window.addEventListener('aicw:closed', onClose);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('aicw:opened', onOpen);
      window.removeEventListener('aicw:closed', onClose);
    };
  }, []);

  if (!visible || chatOpen) return null;

  const openDemo = () => {
    const win = window as Window & { aicw?: (...args: unknown[]) => void };
    win.aicw?.('open');
  };

  return (
    <div
      className="fixed bottom-[72px] left-3 right-3 z-40 rounded-2xl border border-line-200 bg-white/95 p-2 shadow-xl backdrop-blur-md md:hidden"
      role="region"
      aria-label="Быстрый старт"
    >
      <div className="mx-auto flex max-w-lg items-center gap-2">
        <button
          type="button"
          onClick={openDemo}
          className="min-h-11 flex-1 rounded-xl border border-line-200 px-3 text-sm font-medium text-ink-700"
        >
          Демо
        </button>
        <Link href="/register" className="btn-primary shrink-0 px-4 py-2 text-sm">
          Попробовать 7 дней
        </Link>
      </div>
    </div>
  );
}
