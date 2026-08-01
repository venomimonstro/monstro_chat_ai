import { useEffect, useState } from 'react';
import type { LeadDto, LeadStatusHistoryDto, TenantUserDto } from '@ai-consultant/shared-types';
import {
  assignLead,
  fetchLeadHistory,
  fetchLeadMessages,
  fetchTenantUsers,
  mergeLeads,
  updateLeadNotes,
} from '../lib/crm';
import { retryCrmSync } from '../lib/integrations';

export function LeadDetailModal({
  lead,
  onClose,
  onUpdated,
  duplicateLeadId,
}: {
  lead: LeadDto;
  onClose: () => void;
  onUpdated: () => void;
  duplicateLeadId?: string | null;
}) {
  const [messages, setMessages] = useState<
    Array<{ id: string; role: string; content: string; createdAt: string }>
  >([]);
  const [history, setHistory] = useState<LeadStatusHistoryDto[]>([]);
  const [users, setUsers] = useState<TenantUserDto[]>([]);
  const [notes, setNotes] = useState(lead.notes ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setNotes(lead.notes ?? '');
    Promise.all([
      fetchLeadMessages(lead.id),
      fetchLeadHistory(lead.id),
      fetchTenantUsers(),
    ]).then(([msgs, hist, usrs]) => {
      setMessages(msgs);
      setHistory(hist);
      setUsers(usrs);
    });
  }, [lead.id, lead.notes]);

  const saveNotes = async () => {
    setSaving(true);
    try {
      await updateLeadNotes(lead.id, notes);
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (userId: string) => {
    await assignLead(lead.id, userId || null);
    onUpdated();
  };

  const handleMerge = async () => {
    if (!duplicateLeadId) return;
    if (!confirm('Объединить с существующим лидом? Текущий лид будет архивирован.')) {
      return;
    }
    await mergeLeads(lead.id, duplicateLeadId);
    onUpdated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {lead.name ?? 'Без имени'}
            </h2>
            <p className="text-sm text-slate-500">
              {lead.phone ?? '—'} · {lead.email ?? '—'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>

        {lead.attribution && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-700">Атрибуция</p>
            <div className="mt-2 grid gap-1 text-slate-600 sm:grid-cols-2">
              <p>utm_source: {lead.attribution.utmSource ?? '—'}</p>
              <p>utm_medium: {lead.attribution.utmMedium ?? '—'}</p>
              <p>utm_campaign: {lead.attribution.utmCampaign ?? '—'}</p>
              <p>utm_content: {lead.attribution.utmContent ?? '—'}</p>
              <p>utm_term: {lead.attribution.utmTerm ?? '—'}</p>
              <p>referrer: {lead.attribution.referrer ?? '—'}</p>
              <p className="sm:col-span-2">
                landing_page: {lead.attribution.landingPage ?? '—'}
              </p>
              <p>yandex_client_id: {lead.attribution.yandexClientId ?? '—'}</p>
              <p>ga_client_id: {lead.attribution.gaClientId ?? '—'}</p>
            </div>
          </div>
        )}

        {(lead.syncStatus === 'failed' || lead.syncStatus === 'pending') && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-900">
              {lead.syncStatus === 'failed'
                ? 'Не синхронизировано с внешней CRM'
                : 'Синхронизация в очереди'}
            </p>
            {lead.syncError && (
              <p className="mt-1 text-amber-800">{lead.syncError}</p>
            )}
            {lead.syncStatus === 'failed' && (
              <button
                type="button"
                onClick={() => retryCrmSync(lead.id).then(onUpdated)}
                className="mt-2 text-amber-900 underline"
              >
                Повторить синхронизацию
              </button>
            )}
          </div>
        )}

        {duplicateLeadId && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="text-amber-800">Найден лид с таким же телефоном.</p>
            <button
              type="button"
              onClick={handleMerge}
              className="mt-2 text-amber-700 underline"
            >
              Объединить лиды
            </button>
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Ответственный</span>
            <select
              value={lead.assignedUserId ?? ''}
              onChange={(e) => handleAssign(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Не назначен</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm">
            <span className="font-medium text-slate-700">Источник</span>
            <p className="mt-1 text-slate-600">{lead.source?.name ?? '—'}</p>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700">Заметки</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={saveNotes}
            disabled={saving}
            className="mt-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Сохранить заметки
          </button>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-900">Переписка</h3>
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3 text-sm">
            {messages.map((m) => (
              <div key={m.id}>
                <span className="text-xs text-slate-400">{m.role}</span>
                <p>{m.content}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-900">История статусов</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex gap-2 text-slate-600">
                <span className="text-xs text-slate-400">
                  {new Date(h.createdAt).toLocaleString('ru-RU')}
                </span>
                <span>
                  {h.fromStatus?.name ?? '—'} → {h.toStatus?.name}
                </span>
              </li>
            ))}
            {history.length === 0 && (
              <li className="text-slate-500">История пуста</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
