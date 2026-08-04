import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BillingOverviewDto, TenantStatisticsDto } from '@ai-consultant/shared-types';
import { fetchBillingOverview } from '../lib/billing';
import { fetchTenantStatistics } from '../lib/analytics';
import { localDateString } from '../lib/dates';
import { extractErrorMessage } from '../lib/errors';
import { useAuth } from '../lib/auth';
import { getVisibleNavItems, hasPermission, PERMISSIONS } from '../lib/permissions';
import { PageHeader } from '../components/PageHeader';
import { SkeletonGrid } from '../components/Skeleton';
import { ErrorState } from '../components/EmptyState';

function todayRange() {
  const d = localDateString();
  return { from: d, to: d };
}

function UsageCard({ usage }: { usage: BillingOverviewDto['usage'] }) {
  const percent = Math.min(100, usage.percent);
  const color =
    percent >= 100
      ? 'bg-red-500'
      : percent >= 95
        ? 'bg-orange-500'
        : percent >= 80
          ? 'bg-amber-500'
          : 'bg-brand-600';

  return (
    <div className="lk-card">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Сообщения в этом месяце</p>
        <Link to="/billing" className="text-sm text-brand-600 hover:underline">
          Тариф
        </Link>
      </div>
      <p className="mt-2 text-3xl font-semibold text-slate-900">
        {usage.used}{' '}
        <span className="text-lg font-normal text-slate-400">/ {usage.limit}</span>
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = (
    <div className="lk-card transition hover:shadow-md">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
  return href ? <Link to={href}>{body}</Link> : body;
}

function QuickAction({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
    >
      {label}
    </Link>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<BillingOverviewDto | null>(null);
  const [todayStats, setTodayStats] = useState<TenantStatisticsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const canViewBilling = hasPermission(user, PERMISSIONS.SETTINGS_MANAGE);
  const canViewStats = hasPermission(user, PERMISSIONS.ANALYTICS_VIEW);
  const visibleNav = getVisibleNavItems(user);

  const load = async () => {
    setLoading(true);
    setError(null);
    setStatsError(null);
    let statsLoadError: string | null = null;
    try {
      const { from, to } = todayRange();
      const billingPromise = canViewBilling
        ? fetchBillingOverview().catch((err) => {
            throw err;
          })
        : Promise.resolve(null);
      const statsPromise = canViewStats
        ? fetchTenantStatistics(from, to).catch((err) => {
            statsLoadError = extractErrorMessage(err);
            return null;
          })
        : Promise.resolve(null);

      const [billing, stats] = await Promise.all([billingPromise, statsPromise]);
      setOverview(billing);
      setTodayStats(stats);
      setStatsError(statsLoadError);

      const billingFailed = canViewBilling && !billing;
      const statsFailed = canViewStats && !stats && statsLoadError;
      if (billingFailed || statsFailed) {
        setError(
          billingFailed
            ? 'Не удалось загрузить данные тарифа'
            : statsLoadError ?? 'Не удалось загрузить статистику',
        );
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [canViewBilling, canViewStats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Добро пожаловать" description="Обзор аккаунта и быстрые действия" />
        <SkeletonGrid count={4} />
      </div>
    );
  }
  if (error && !overview && !todayStats) {
    return <ErrorState message={error} onRetry={load} />;
  }

  const quickActions = [
    hasPermission(user, PERMISSIONS.SOURCES_MANAGE)
      ? { to: '/sources', label: 'Настроить источники' }
      : null,
    hasPermission(user, PERMISSIONS.CRM_LEADS_VIEW)
      ? { to: '/crm', label: 'Посмотреть CRM' }
      : null,
    hasPermission(user, PERMISSIONS.ANALYTICS_VIEW)
      ? { to: '/statistics', label: 'Статистика' }
      : null,
    hasPermission(user, PERMISSIONS.SETTINGS_MANAGE)
      ? { to: '/integrations', label: 'Подключить интеграции' }
      : null,
  ].filter(Boolean) as Array<{ to: string; label: string }>;

  return (
    <div>
      <PageHeader
        title="Добро пожаловать"
        description={
          overview
            ? 'Обзор аккаунта, расход лимитов и быстрые действия'
            : 'Обзор активности и быстрые действия'
        }
      />

      {overview?.trialDaysLeft !== null &&
        overview?.trialDaysLeft !== undefined &&
        overview.trialDaysLeft > 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          Пробный период: осталось {overview.trialDaysLeft}{' '}
          {overview.trialDaysLeft === 1
            ? 'день'
            : overview.trialDaysLeft < 5
              ? 'дня'
              : 'дней'}.{' '}
          <Link to="/billing" className="font-medium underline">
            Выбрать тариф
          </Link>
        </div>
      )}

      {overview?.tenantStatus === 'trial_expired' && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          Пробный период закончился.{' '}
          <Link to="/billing" className="font-medium underline">
            Оформите подписку
          </Link>
        </div>
      )}

      {statsError && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Статистика за сегодня недоступна: {statsError}
        </div>
      )}

      {todayStats && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Сегодня</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <StatCard label="Диалоги" value={todayStats.dialogs} href="/statistics" />
            <StatCard label="Лиды" value={todayStats.leads} href="/crm" />
            <StatCard
              label="Конверсия"
              value={`${todayStats.conversionRate}%`}
              href="/statistics"
            />
          </div>
        </div>
      )}

      {overview && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UsageCard usage={overview.usage} />
          <StatCard label="Баланс" value={formatCurrency(overview.balance, 'RUB')} href="/billing" />
          <StatCard
            label="Подписка"
            value={overview.subscription?.tariff?.name ?? 'Пробный период'}
            href="/billing"
          />
          <StatCard label="Статус" value={formatStatus(overview.tenantStatus)} />
        </div>
      )}

      {!overview && todayStats && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Разделы тарифа и настроек доступны владельцу аккаунта. У вас есть доступ к CRM и статистике.
        </div>
      )}

      {quickActions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Быстрые действия</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action) => (
              <QuickAction key={action.to} to={action.to} label={action.label} />
            ))}
          </div>
        </div>
      )}

      {hasPermission(user, PERMISSIONS.SOURCES_MANAGE) && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">Начало работы</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OnboardingStep
              number={1}
              title="Добавьте источник"
              description="Создайте чат для сайта и скопируйте код установки."
              to="/sources"
            />
            <OnboardingStep
              number={2}
              title="Обучите агента"
              description="Загрузите базу знаний и настройте промпт."
              to="/sources"
            />
            <OnboardingStep
              number={3}
              title="Подключите CRM"
              description="Настройте интеграцию с amoCRM или Bitrix24."
              to="/integrations"
            />
            <OnboardingStep
              number={4}
              title="Следите за статистикой"
              description="Анализируйте диалоги, лиды и конверсию."
              to="/statistics"
            />
          </div>
        </div>
      )}

      {visibleNav.length <= 2 && !hasPermission(user, PERMISSIONS.SOURCES_MANAGE) && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Используйте пункты меню слева для работы с лидами и статистикой.
        </div>
      )}
    </div>
  );
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function OnboardingStep({
  number,
  title,
  description,
  to,
}: {
  number: number;
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 hover:shadow-sm"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 transition group-hover:bg-brand-200">
        {number}
      </div>
      <p className="mt-3 font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </Link>
  );
}

function formatStatus(status: string) {
  switch (status) {
    case 'active':
      return 'Активен';
    case 'trialing':
      return 'Пробный период';
    case 'trial_expired':
      return 'Пробный период закончился';
    case 'suspended':
      return 'Приостановлен';
    default:
      return status;
  }
}
