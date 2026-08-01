'use client';

import Link from 'next/link';
import { useState } from 'react';
import { siteConfig } from '@/lib/site';

const links = [
  { href: '/pricing', label: 'Тарифы' },
  { href: '/blog', label: 'Блог' },
];

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-brand-600">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            AI
          </span>
          {siteConfig.name}
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-brand-600">
              {link.label}
            </Link>
          ))}
          <a href={`${siteConfig.clientAppUrl}/login`} className="hover:text-brand-600">
            Войти
          </a>
          <a href="/register" className="btn-primary px-5 py-2 text-sm">
            Начать бесплатно
          </a>
        </nav>

        <button
          type="button"
          className="md:hidden rounded-lg p-2 text-slate-600 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
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
        <div className="border-t border-slate-100 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-4 text-sm font-medium text-slate-600">
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                {link.label}
              </Link>
            ))}
            <a href={`${siteConfig.clientAppUrl}/login`}>Войти</a>
            <a href="/register" className="btn-primary text-center">Начать бесплатно</a>
          </nav>
        </div>
      )}
    </header>
  );
}
