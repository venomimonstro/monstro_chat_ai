import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { extractErrorMessage } from '../lib/errors';
import type { TariffDto, TenantDetailDto, TenantMarginDto } from '@ai-consultant/shared-types';
import {
  adjustTenantBalance,
  blockTenant,
  changeTenantTariff,
  fetchAdminTariffs,
  fetchTenantDetail,
  fetchTenantMargin,
  impersonateTenant,
  resetTenantPassword,
  unblockTenant,
} from '../lib/api';
import { ErrorState, LoadingState, StatusBadge } from '../components/UiState';

function formatRub(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
}

const statusLabels: Record<string, string> = {
  active: 'Активен',
  suspended: 'Заблокирован',
  trial_expired: 'Триал истёк',
  trialing: 'Пробный период',
};

const statusColors: Record<string, string> = {
  active: 'bg-emerald-900/50 text-emerald-300',
  suspended: 'bg-red-900/50 text-red-300',
  trial_expired: 'bg-amber-900/50 text-amber-300',
  trialing: 'bg-blue-900/50 text-blue-300',
};

function ReasonModal({
  title,
  confirmLabel,
  onClose,
  onConfirm,
  children,
  danger,
}: {
  title: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  children?: React.ReactNode;
  danger?: boolean;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (reason.trim().length < 3) {
      setError('Укажите причину (минимум 3 символа)');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        {children}
        <label className="mt-4 block text-sm text-slate-400">
          Причина (обязательно)
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200">
            Отмена
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {saving ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<TenantDetailDto | null>(null);
  const [margin, setMargin] = useState<TenantMarginDto | null>(null);
  const [tariffs, setTariffs] = useState<TariffDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<
    'block' | 'unblock' | 'balance' | 'tariff' | 'password' | 'impersonate' | null
  >(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [selectedTariffId, setSelectedTariffId] = useState('');
  const [passwordResult, setPasswordResult] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([fetchTenantDetail(id), fetchTenantMargin(id)])
      .then(([detail, marginData]) => {
        setTenant(detail);
        setMargin(marginData);
        setSelectedTariffId(detail.tariff?.id ?? '');
      })
      .catch(() => setError('Не удалось загрузить данные клиента'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    reload();
    fetchAdminTariffs().then(setTariffs).catch(() => undefined);
  }, [reload]);

  if (loading) return <LoadingState message="Загрузка клиента…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!tenant || !margin) return null;

  return (
    <div>
      <Link to="/tenants" className="text-sm text-brand-400 hover:text-brand-300">
        ← К списку клиентов
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{tenant.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <StatusBadge status={tenant.status} labels={statusLabels} colors={statusColors} />
            <span>·</span>
            <span>Баланс: {formatRub(tenant.balance)}</span>
          </div>
          {tenant.owner && (
            <p className="mt-1 text-sm text-slate-500">Владелец: {tenant.owner.email}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {tenant.status === 'suspended' ? (
            <button
              type="button"
              onClick={() => setModal('unblock')}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              Разблокировать
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setModal('block')}
              className="rounded-lg border border-red-800 px-3 py-2 text-sm text-red-300 hover:bg-red-950/50"
            >
              Заблокировать
            </button>
          )}
          <button
            type="button"
            onClick={() => setModal('balance')}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Баланс
          </button>
          <button
            type="button"
            onClick={() => setModal('tariff')}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Тариф
          </button>
          <button
            type="button"
            onClick={() => setModal('password')}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Сброс пароля
          </button>
          <button
            type="button"
            onClick={() => setModal('impersonate')}
            className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Войти в аккаунт
          </button>
        </div>
      </div>

      {passwordResult && (
        <div className="mt-4 rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-200">
          Временный пароль: <code className="rounded bg-amber-950 px-1 py-0.5">{passwordResult}</code>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Пользователи" value={String(tenant.stats.users)} />
        <StatCard label="Диалоги" value={String(tenant.stats.dialogs)} />
        <StatCard label="Лиды" value={String(tenant.stats.leads)} />
        <StatCard label="Источники" value={String(tenant.stats.sources)} />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-100">Финансы и маржа</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Доход (мес.)" value={formatRub(margin.revenueRub)} />
          <StatCard label="Расход LLM" value={formatRub(margin.llmCostRub)} />
          <StatCard
            label="Маржа"
            value={formatRub(margin.marginRub)}
            highlight={margin.marginRub >= 0 ? 'positive' : 'negative'}
          />
          <StatCard label="Маржа %" value={`${margin.marginPercent}%`} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-100">Подписка</h2>
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-slate-400">Тариф</p>
              <p className="mt-1 text-slate-100">{tenant.tariff?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-slate-400">Статус</p>
              <p className="mt-1 text-slate-100">{tenant.status ?? '—'}</p>
            </div>
            <div>
              <p className="text-slate-400">Триал до</p>
              <p className="mt-1 text-slate-100">
                {tenant.trialEndsAt
                  ? new Date(tenant.trialEndsAt).toLocaleDateString('ru-RU')
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {modal === 'block' && (
        <ReasonModal
          title="Заблокировать тенанта"
          confirmLabel="Заблокировать"
          danger
          onClose={() => setModal(null)}
          onConfirm={async (reason) => {
            await blockTenant(tenant.id, reason);
            reload();
          }}
        />
      )}

      {modal === 'unblock' && (
        <ReasonModal
          title="Разблокировать тенанта"
          confirmLabel="Разблокировать"
          onClose={() => setModal(null)}
          onConfirm={async (reason) => {
            await unblockTenant(tenant.id, reason);
            reload();
          }}
        />
      )}

      {modal === 'balance' && (
        <ReasonModal
          title="Корректировка баланса"
          confirmLabel="Применить"
          onClose={() => setModal(null)}
          onConfirm={async (reason) => {
            const amount = Number(balanceAmount);
            if (!Number.isFinite(amount) || amount === 0) {
              throw new Error('invalid amount');
            }
            await adjustTenantBalance(tenant.id, amount, reason);
            reload();
          }}
        >
          <label className="mt-3 block text-sm text-slate-400">
            Сумма (+ начисление, − списание)
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              value={balanceAmount}
              onChange={(e) => setBalanceAmount(e.target.value)}
            />
          </label>
        </ReasonModal>
      )}

      {modal === 'tariff' && (
        <ReasonModal
          title="Смена тарифа"
          confirmLabel="Сохранить"
          onClose={() => setModal(null)}
          onConfirm={async (reason) => {
            await changeTenantTariff(tenant.id, selectedTariffId, reason);
            reload();
          }}
        >
          <select
            className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={selectedTariffId}
            onChange={(e) => setSelectedTariffId(e.target.value)}
          >
            {tariffs.map((tariff) => (
              <option key={tariff.id} value={tariff.id}>
                {tariff.name} — {formatRub(tariff.price)}
              </option>
            ))}
          </select>
        </ReasonModal>
      )}

      {modal === 'password' && (
        <ReasonModal
          title="Сброс пароля владельца"
          confirmLabel="Сбросить"
          danger
          onClose={() => setModal(null)}
          onConfirm={async (reason) => {
            const result = await resetTenantPassword(tenant.id, reason);
            setPasswordResult(
              result.temporaryPassword ??
                'Пароль сброшен. Владелец должен использовать сброс пароля через email.',
            );
          }}
        />
      )}

      {modal === 'impersonate' && (
        <ReasonModal
          title="Войти в аккаунт клиента"
          confirmLabel="Войти"
          onClose={() => setModal(null)}
          onConfirm={async (reason) => {
            const result = await impersonateTenant(tenant.id, reason);
            const url = `${result.webClientUrl}/impersonate?code=${encodeURIComponent(result.exchangeCode)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
          }}
        >
          <p className="mt-2 text-sm text-slate-400">
            Откроется личный кабинет клиента в новой вкладке. Действие будет записано в аудит-лог.
          </p>
        </ReasonModal>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'positive' | 'negative';
}) {
  const color =
    highlight === 'positive'
      ? 'text-green-400'
      : highlight === 'negative'
        ? 'text-red-400'
        : 'text-slate-100';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
