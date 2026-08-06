import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { extractErrorMessage } from '../lib/errors';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import type { LeadDto, PipelineDto, PipelineStatusDto } from '@ai-consultant/shared-types';
import {
  fetchLeads,
  fetchLead,
  fetchPipelines,
  updateLeadStatus,
  createPipelineStatus,
  deletePipelineStatus,
  archiveLeads,
} from '../lib/crm';
import { downloadLeadsCsv } from '../lib/export';
import { LeadDetailModal } from '../components/LeadDetailModal';
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState';

function LeadCard({
  lead,
  onClick,
  saving,
  selected,
  onToggleSelect,
}: {
  lead: LeadDto;
  onClick: () => void;
  saving?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: lead.id });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`relative cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md ${
        isDragging ? 'opacity-50' : ''
      } ${saving ? 'ring-2 ring-brand-400 ring-offset-1' : ''} ${
        selected ? 'border-brand-400 bg-brand-50' : ''
      }`}
    >
      {onToggleSelect ? (
        <input
          type="checkbox"
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={onToggleSelect}
          className="absolute right-2 top-2 h-4 w-4 rounded border-slate-300"
          aria-label="Выбрать лид"
        />
      ) : null}
      {saving ? (
        <p className="mb-1 text-xs font-medium text-brand-600">Сохранение…</p>
      ) : null}
      <p className="font-medium text-slate-900">{lead.name ?? 'Без имени'}</p>
      <p className="mt-1 text-xs text-slate-500">{lead.phone ?? lead.email ?? '—'}</p>
      {lead.syncStatus === 'failed' && (
        <p className="mt-2 text-xs font-medium text-amber-700">
          ⚠ Не синхронизировано
        </p>
      )}
      {lead.assignedUser && (
        <p className="mt-2 text-xs text-brand-600">{lead.assignedUser.email}</p>
      )}
    </div>
  );
}

function KanbanColumn({
  status,
  leads,
  onLeadClick,
  savingLeadId,
  selectedIds,
  onToggleSelect,
}: {
  status: PipelineStatusDto;
  leads: LeadDto[];
  onLeadClick: (lead: LeadDto) => void;
  savingLeadId: string | null;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-xl border bg-slate-50 ${
        isOver ? 'border-brand-400 bg-brand-50' : 'border-slate-200'
      }`}
    >
      <div
        className="flex items-center gap-2 border-b border-slate-200 px-3 py-2"
        style={{ borderTopColor: status.color, borderTopWidth: 3 }}
      >
        <span className="text-sm font-semibold text-slate-800">{status.name}</span>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
          {leads.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ minHeight: 200 }}>
        {leads.length === 0 ? (
          <p className="p-4 text-center text-xs text-slate-400">Нет лидов</p>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              saving={savingLeadId === lead.id}
              selected={selectedIds.has(lead.id)}
              onToggleSelect={() => onToggleSelect(lead.id)}
              onClick={() => onLeadClick(lead)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function CrmPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pipelines, setPipelines] = useState<PipelineDto[]>([]);
  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadDto | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newStatusName, setNewStatusName] = useState('');
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archiving, setArchiving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const pipeline = pipelines[0] ?? null;
  const statuses = pipeline?.statuses ?? [];

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [p, l] = await Promise.all([fetchPipelines(), fetchLeads()]);
      setPipelines(p);
      setLeads(l);
    } catch (e: unknown) {
      setLoadError(extractErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const leadIdParam = searchParams.get('leadId');

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!leadIdParam) return;
    let cancelled = false;
    fetchLead(leadIdParam)
      .then((lead) => {
        if (!cancelled) setSelectedLead(lead);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setSearchParams(
            (params) => {
              const next = new URLSearchParams(params);
              next.delete('leadId');
              return next;
            },
            { replace: true },
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [leadIdParam, setSearchParams]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSelectedIds(new Set());
        if (document.activeElement === searchRef.current) {
          setQuery('');
          searchRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkArchive = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Архивировать ${selectedIds.size} лид(ов)?`)) return;
    setArchiving(true);
    try {
      await archiveLeads([...selectedIds]);
      setSelectedIds(new Set());
      await reload();
    } catch (e: unknown) {
      setActionError(extractErrorMessage(e));
    } finally {
      setArchiving(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadLeadsCsv();
    } catch (e: unknown) {
      setActionError(extractErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const filteredLeads = useMemo(() => {
    if (!query.trim()) return leads;
    const q = query.toLowerCase();
    return leads.filter(
      (l) =>
        (l.name ?? '').toLowerCase().includes(q) ||
        (l.phone ?? '').toLowerCase().includes(q) ||
        (l.email ?? '').toLowerCase().includes(q),
    );
  }, [leads, query]);

  const leadsByStatus = useMemo(() => {
    const map: Record<string, LeadDto[]> = {};
    for (const s of statuses) map[s.id] = [];
    for (const lead of filteredLeads) {
      if (lead.statusId && map[lead.statusId]) {
        map[lead.statusId].push(lead);
      } else if (statuses[0]) {
        map[statuses[0].id]?.push(lead);
      }
    }
    return map;
  }, [filteredLeads, statuses]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const leadId = String(event.active.id);
    const newStatusId = event.over ? String(event.over.id) : null;
    if (!newStatusId || !statuses.some((s) => s.id === newStatusId)) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.statusId === newStatusId) return;

    const prev = leads;
    setSavingLeadId(leadId);
    setLeads((current) =>
      current.map((l) =>
        l.id === leadId ? { ...l, statusId: newStatusId } : l,
      ),
    );

    try {
      await updateLeadStatus(leadId, newStatusId);
    } catch (e: unknown) {
      setLeads(prev);
      setActionError(extractErrorMessage(e));
    } finally {
      setSavingLeadId(null);
    }
  };

  const addStatus = async () => {
    if (!pipeline || !newStatusName.trim()) return;
    try {
      await createPipelineStatus(pipeline.id, { name: newStatusName.trim() });
      setNewStatusName('');
      await reload();
    } catch (e: unknown) {
      setActionError(extractErrorMessage(e));
    }
  };

  const removeStatus = async (statusId: string) => {
    if (!confirm('Удалить статус? Лиды в нём останутся без статуса.')) return;
    try {
      await deletePipelineStatus(statusId);
      await reload();
    } catch (e: unknown) {
      setActionError(extractErrorMessage(e));
    }
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  if (loading) return <LoadingState message="Загрузка CRM…" />;
  if (loadError) return <ErrorState message={loadError} onRetry={reload} />;
  if (!pipeline) {
    return (
      <EmptyState
        title="Воронка не найдена"
        description="Создайте первую воронку через API или обратитесь в поддержку."
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM</h1>
          <p className="text-sm text-slate-500">{pipeline.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по лидам… (/)"
            className="lk-input py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={() => void exportCsv()}
            disabled={exporting}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {exporting ? 'Экспорт…' : 'Экспорт CSV'}
          </button>
          <input
            value={newStatusName}
            onChange={(e) => setNewStatusName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addStatus()}
            placeholder="Новый статус"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={addStatus}
            disabled={!newStatusName.trim()}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Добавить колонку
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm">
          <span className="font-medium text-brand-800">
            Выбрано: {selectedIds.size}
          </span>
          <button
            type="button"
            disabled={archiving}
            onClick={bulkArchive}
            className="lk-btn-primary py-1 text-xs"
          >
            {archiving ? 'Архивация…' : 'Архивировать'}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-brand-700 hover:underline"
          >
            Снять выделение (Esc)
          </button>
        </div>
      )}

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setActionError(null)}
          >
            закрыть
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statuses.map((status) => (
            <div key={status.id} className="shrink-0">
              <KanbanColumn
                status={status}
                leads={leadsByStatus[status.id] ?? []}
                savingLeadId={savingLeadId}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onLeadClick={setSelectedLead}
              />
              <button
                type="button"
                onClick={() => removeStatus(status.id)}
                className="mt-1 text-xs text-red-500 hover:underline"
              >
                Удалить колонку
              </button>
            </div>
          ))}
        </div>
        <DragOverlay>
          {activeLead ? (
            <div className="w-72 rounded-lg border bg-white p-3 shadow-lg">
              <p className="font-medium">{activeLead.name ?? 'Без имени'}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={reload}
        />
      )}
    </div>
  );
}
