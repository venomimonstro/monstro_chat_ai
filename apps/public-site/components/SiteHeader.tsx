'use client';

import Link from 'next/link';
import { useState } from 'react';
import { siteConfig } from '@/lib/site';

const links = [
  { href: '/#how', label: 'Как работает' },
  { href: '/#for-whom', label: 'Для кого' },
  { href: '/pricing', label: 'Тарифы' },
  { href: '/blog', label: 'Блог' },
];

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-cta transition group-hover:shadow-lg">
            M
          </span>
          <span className="text-lg font-bold text-ink-900">{siteConfig.name}</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-ink-700 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-brand-600">
              {link.label}
            </Link>
          ))}
          <a href={`${siteConfig.clientAppUrl}/login`} className="transition hover:text-brand-600">
            Войти
          </a>
          <a href="/register" className="btn-primary px-5 py-2 text-sm">
            Попробовать бесплатно
          </a>
        </nav>

        <button
          type="button"
          className="rounded-lg p-2 text-ink-700 transition hover:bg-surface-50 md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-line-200 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3 text-sm font-medium text-ink-700">
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                {link.label}
              </Link>
            ))}
            <a href={`${siteConfig.clientAppUrl}/login`}>Войти</a>
            <a href="/register" className="btn-primary text-center">
              Попробовать бесплатно
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
