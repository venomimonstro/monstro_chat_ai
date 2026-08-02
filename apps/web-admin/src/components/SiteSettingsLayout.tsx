import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { to: '/site-settings', label: 'Чат и виджет', end: true },
  { to: '/site-settings/code', label: 'Код' },
  { to: '/site-settings/diagnostics', label: 'Диагностика' },
];

export function SiteSettingsLayout() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Настройки сайта</h1>
        <p className="mt-1 text-sm text-slate-400">
          Публичный лендинг, виджет чата, произвольные скрипты и ссылка диагностики
        </p>
      </div>

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-brand-600/20 text-brand-300'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
