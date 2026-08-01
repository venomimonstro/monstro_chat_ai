import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { NotificationBell } from './NotificationBell';
import { PwaInstallBanner } from './PwaInstallBanner';

const navItems = [
  { to: '/', label: 'Главная', short: '⌂', end: true },
  { to: '/sources', label: 'Источники', short: '◎' },
  { to: '/crm', label: 'CRM', short: '▦' },
  { to: '/billing', label: 'Тариф', short: '₽' },
  { to: '/integrations', label: 'Интеграции', short: '⚡' },
  { to: '/statistics', label: 'Статистика', short: '📊' },
  { to: '/settings', label: 'Настройки', short: '⚙' },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const apply = () => setCollapsed(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const sidebarWidth = collapsed ? 'w-[4.5rem]' : 'w-64';

  return (
    <div className="flex min-h-screen">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex ${sidebarWidth} flex-col border-r border-slate-200 bg-white transition-all duration-200 lg:static ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className={`border-b border-slate-200 py-5 ${collapsed ? 'px-3 text-center' : 'px-6'}`}>
          <p className={`font-bold text-brand-700 ${collapsed ? 'text-sm' : 'text-lg'}`}>
            {collapsed ? 'AI' : 'AI-Консультант'}
          </p>
          {!collapsed && <p className="text-xs text-slate-500">Личный кабинет</p>}
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              <span className="text-base" aria-hidden>
                {item.short}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className={`border-t border-slate-200 p-3 ${collapsed ? 'text-center' : ''}`}>
          {!collapsed && (
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
              <NotificationBell />
            </div>
          )}
          {collapsed && (
            <div className="mb-2 flex justify-center">
              <NotificationBell />
            </div>
          )}
          <button
            type="button"
            onClick={() => logout()}
            className={`mt-2 text-sm text-slate-600 transition hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500 ${
              collapsed ? 'w-full' : ''
            }`}
            title="Выйти"
          >
            {collapsed ? '⎋' : 'Выйти'}
          </button>
          <button
            type="button"
            className="mt-2 hidden text-xs text-slate-400 hover:text-slate-600 lg:block"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? 'Развернуть' : 'Свернуть'}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label={mobileOpen ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={mobileOpen}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          <p className="font-bold text-brand-700">AI-Консультант</p>
          <NotificationBell />
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <PwaInstallBanner />
          {user?.impersonation && (
            <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              В вашем аккаунте работает поддержка ({user.impersonation.actorEmail}
              {user.impersonation.reason ? `: ${user.impersonation.reason}` : ''}
              ).
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
