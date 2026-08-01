import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../lib/auth';

const navItems = [
  { to: '/', label: 'Дашборд', end: true },
  { to: '/tenants', label: 'Клиенты' },
  { to: '/tariffs', label: 'Тарифы' },
  { to: '/providers', label: 'LLM-провайдеры' },
  { to: '/analytics', label: 'Аналитика' },
  { to: '/updates', label: 'Обновления' },
  { to: '/backups', label: 'Бэкапы' },
  { to: '/audit', label: 'Аудит' },
];

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-slate-800 px-6 py-5">
          <p className="text-lg font-bold text-brand-500">AI-Консультант</p>
          <p className="text-xs text-slate-400">Админ-панель</p>
        </div>
        <nav className="space-y-1 p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400 ${
                  isActive
                    ? 'bg-brand-600/20 text-brand-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-800 p-4">
          <p className="truncate text-sm text-slate-300">{user?.email}</p>
          <button
            type="button"
            onClick={onLogout}
            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-400 transition hover:bg-red-950/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400"
          >
            Выйти
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400"
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
          <p className="font-bold text-brand-500">AI-Консультант</p>
          <div className="w-10" />
        </header>

        <main className="flex-1 overflow-x-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
