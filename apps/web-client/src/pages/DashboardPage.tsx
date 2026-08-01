import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BillingOverviewDto, TenantStatisticsDto } from '@ai-consultant/shared-types';
import { fetchBillingOverview } from '../lib/billing';
import { fetchTenantStatistics } from '../lib/analytics';
import { PageHeader } from '../components/PageHeader';
import { SkeletonGrid } from '../components/Skeleton';
import { ErrorState } from '../components/EmptyState';

function todayRange() {
  const d = new Date().toISOString().slice(0, 10);
  return { from: d, to: d };
}

function UsageCard({ usage }: { usage: BillingOverviewDto['usage'] }) {
  const percent = usage.percent;
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
  const [overview, setOverview] = useState<BillingOverviewDto | null>(null);
  const [todayStats, setTodayStats] = useState<TenantStatisticsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = todayRange();
      const [billing, stats] = await Promise.all([
        fetchBillingOverview(),
        fetchTenantStatistics(from, to).catch(() => null),
      ]);
      setOverview(billing);
      setTodayStats(stats);
    } catch {
      setError('Не удалось загрузить обзор аккаунта');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Добро пожаловать" description="Обзор аккаунта и быстрые действия" />
        <SkeletonGrid count={4} />
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!overview) return null;

  return (
    <div>
      <PageHeader
        title="Добро пожаловать"
        description="Обзор аккаунта, расход лимитов и быстрые действия"
      />

      {overview.trialDaysLeft !== null && overview.trialDaysLeft > 0 && (
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

      {overview.tenantStatus === 'trial_expired' && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
          Пробный период закончился.{' '}
          <Link to="/billing" className="font-medium underline">
            Оформите подписку
          </Link>
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

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UsageCard usage={overview.usage} />
        <StatCard label="Баланс" value={formatCurrency(overview.balance, 'RUB')} href="/billing" />
        <StatCard label="Подписка" value={overview.subscription?.tariff?.name ?? 'Пробный период'} href="/billing" />
        <StatCard label="Статус" value={formatStatus(overview.tenantStatus)} />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900">Быстрые действия</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction to="/sources" label="Настроить источники" />
          <QuickAction to="/crm" label="Посмотреть CRM" />
          <QuickAction to="/statistics" label="Статистика" />
          <QuickAction to="/integrations" label="Подключить интеграции" />
        </div>
      </div>

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
