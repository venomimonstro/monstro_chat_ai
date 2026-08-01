import { useEffect, useState } from 'react';
import type { TariffDto } from '@ai-consultant/shared-types';
import {
  createAdminTariff,
  deactivateAdminTariff,
  fetchAdminTariffs,
  updateAdminTariff,
  type CreateTariffPayload,
} from '../lib/api';
import { EmptyState, ErrorState, LoadingState } from '../components/UiState';

const emptyForm: CreateTariffPayload = {
  name: '',
  price: 0,
  period: 'month',
  currency: 'RUB',
  messageLimit: 1000,
  sourceLimit: 1,
  kbLimitMb: 100,
  overagePolicy: 'block',
  isActive: true,
};

function formatRub(value: number | string) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function TariffsPage() {
  const [tariffs, setTariffs] = useState<TariffDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TariffDto | null>(null);
  const [form, setForm] = useState<CreateTariffPayload>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchAdminTariffs()
      .then(setTariffs)
      .catch(() => setError('Не удалось загрузить тарифы'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (tariff: TariffDto) => {
    setEditing(tariff);
    setForm({
      name: tariff.name,
      price: tariff.price,
      period: tariff.period,
      currency: tariff.currency,
      messageLimit: tariff.messageLimit,
      sourceLimit: tariff.sourceLimit,
      kbLimitMb: tariff.kbLimitMb,
      overagePolicy: tariff.overagePolicy,
      isActive: tariff.isActive,
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (editing) {
        await updateAdminTariff(editing.id, form);
        setMessage('Тариф обновлён');
      } else {
        await createAdminTariff(form);
        setMessage('Тариф создан');
      }
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Ошибка сохранения')
          : 'Ошибка сохранения';
      setMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (tariff: TariffDto) => {
    const subs = tariff.activeSubscriptions ?? 0;
    if (subs > 0) {
      const ok = confirm(
        `У тарифа «${tariff.name}» ${subs} активных подписок. Деактивация будет отклонена API. Продолжить?`,
      );
      if (!ok) return;
    } else if (!confirm(`Деактивировать тариф «${tariff.name}»?`)) {
      return;
    }
    try {
      await deactivateAdminTariff(tariff.id);
      setMessage('Тариф деактивирован');
      load();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Не удалось деактивировать')
          : 'Не удалось деактивировать';
      setMessage(msg);
    }
  };

  if (loading) return <LoadingState message="Загрузка тарифов…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Тарифы</h1>
          <p className="mt-1 text-sm text-slate-400">
            Создание, редактирование и деактивация тарифов
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Новый тариф
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-lg bg-emerald-900/40 px-4 py-2 text-sm text-emerald-300">
          {message}
        </div>
      )}

      {tariffs.length === 0 ? (
        <EmptyState
          title="Тарифы не найдены"
          description="Создайте первый тариф для продажи подписок."
          action={
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white"
            >
              Создать тариф
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
              <tr>
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Цена</th>
                <th className="px-4 py-3">Период</th>
                <th className="px-4 py-3">Лимит</th>
                <th className="px-4 py-3">Подписки</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {tariffs.map((tariff) => (
                <tr
                  key={tariff.id}
                  className="border-b border-slate-800/80 transition hover:bg-slate-900/50"
                >
                  <td className="px-4 py-3 font-medium text-slate-100">{tariff.name}</td>
                  <td className="px-4 py-3 text-slate-300">{formatRub(tariff.price)}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {tariff.period === 'year' ? 'Год' : 'Месяц'}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{tariff.messageLimit}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {tariff.activeSubscriptions ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        tariff.isActive
                          ? 'bg-emerald-900/50 text-emerald-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {tariff.isActive ? 'Активен' : 'Отключён'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(tariff)}
                      className="mr-2 text-brand-400 hover:underline"
                    >
                      Изменить
                    </button>
                    {tariff.isActive && (
                      <button
                        type="button"
                        onClick={() => deactivate(tariff)}
                        className="text-red-400 hover:underline"
                      >
                        Деактивировать
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold text-slate-100">
              {editing ? 'Редактировать тариф' : 'Новый тариф'}
            </h2>
            <div className="mt-4 space-y-3">
              <Field label="Название">
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Цена">
                  <input
                    type="number"
                    className="input"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Период">
                  <select
                    className="input"
                    value={form.period}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        period: e.target.value as 'month' | 'year',
                      })
                    }
                  >
                    <option value="month">Месяц</option>
                    <option value="year">Год</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Лимит сообщений">
                  <input
                    type="number"
                    className="input"
                    value={form.messageLimit}
                    onChange={(e) =>
                      setForm({ ...form, messageLimit: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Источников">
                  <input
                    type="number"
                    className="input"
                    value={form.sourceLimit}
                    onChange={(e) =>
                      setForm({ ...form, sourceLimit: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>
              <Field label="База знаний (МБ)">
                <input
                  type="number"
                  className="input"
                  value={form.kbLimitMb}
                  onChange={(e) =>
                    setForm({ ...form, kbLimitMb: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Перерасход">
                <select
                  className="input"
                  value={form.overagePolicy}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      overagePolicy: e.target.value as 'block' | 'charge' | 'allow',
                    })
                  }
                >
                  <option value="block">Блокировка</option>
                  <option value="charge">Списание</option>
                  <option value="allow">Без ограничений</option>
                </select>
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={saving || !form.name.trim()}
                onClick={save}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.input{width:100%;border-radius:0.5rem;border:1px solid #334155;background:#020617;padding:0.5rem 0.75rem;font-size:0.875rem;color:#f1f5f9}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
