import Link from 'next/link';
import { siteConfig } from '@/lib/site';

const productLinks = [
  { href: '/pricing', label: 'Тарифы' },
  { href: '/blog', label: 'Блог' },
  { href: '/register', label: 'Регистрация' },
];

const legalLinks = [
  { href: '/legal/privacy', label: 'Политика конфиденциальности' },
  { href: '/legal/terms', label: 'Публичная оферта' },
  { href: '/legal/consent', label: 'Согласие на обработку ПД' },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-100 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold text-brand-600">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                AI
              </span>
              {siteConfig.name}
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">
              {siteConfig.description}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Продукт</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-brand-600">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Документы</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-brand-600">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} {siteConfig.name}. Все права защищены.
        </div>
      </div>
    </footer>
  );
}
