import { useEffect, useState } from 'react';
import type {
  CrmStatusMappingResponse,
  FieldMappingItem,
  SaveStatusMappingDto,
} from '@ai-consultant/shared-types';
import {
  fetchAmocrmFieldMapping,
  fetchAmocrmStatusMapping,
  fetchBitrixFieldMapping,
  fetchBitrixStatusMapping,
  getAmocrmConnectUrl,
  getBitrixConnectUrl,
  mockConnectAmocrm,
  mockConnectBitrix24,
  disconnectAmocrm,
  disconnectBitrix24,
  retryCrmSync,
  saveAmocrmFieldMapping,
  saveAmocrmStatusMapping,
  saveBitrixFieldMapping,
  saveBitrixStatusMapping,
} from '../lib/integrations';

function FieldMappingEditor({
  title,
  mappings,
  onChange,
  onSave,
  saving,
}: {
  title: string;
  mappings: FieldMappingItem[];
  onChange: (next: FieldMappingItem[]) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-sm font-medium text-slate-700">{title}</h3>
      {mappings.map((row, index) => (
        <div key={row.internalField} className="grid gap-2 sm:grid-cols-2">
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={row.internalField}
            readOnly
          />
          <input
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={row.externalField}
            onChange={(e) => {
              const next = [...mappings];
              next[index] = { ...row, externalField: e.target.value };
              onChange(next);
            }}
          />
        </div>
      ))}
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {saving ? 'Сохранение…' : 'Сохранить маппинг'}
      </button>
    </div>
  );
}

function StatusMappingEditor({
  statusMapping,
  onChange,
  onSave,
  saving,
  error,
}: {
  statusMapping: CrmStatusMappingResponse;
  onChange: (next: CrmStatusMappingResponse) => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
}) {
  const incomplete =
    statusMapping.bidirectionalSync &&
    statusMapping.mappings.some((row) => !row.externalStatusId.trim());

  return (
    <div className="mt-4 space-y-3">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={statusMapping.bidirectionalSync}
          onChange={(e) =>
            onChange({
              ...statusMapping,
              bidirectionalSync: e.target.checked,
            })
          }
        />
        Двусторонняя синхронизация статусов
      </label>

      {statusMapping.bidirectionalSync && (
        <>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p>
              Webhook URL:{' '}
              <code className="break-all">{statusMapping.webhookUrl}</code>
            </p>
            {statusMapping.webhookSecret && (
              <p className="mt-1">
                Secret:{' '}
                <code className="break-all">{statusMapping.webhookSecret}</code>
              </p>
            )}
            <p className="mt-1">
              Заголовок: <code>X-Webhook-Secret</code>
            </p>
          </div>

          <h3 className="text-sm font-medium text-slate-700">
            Маппинг статусов воронки
          </h3>
          {statusMapping.mappings.map((row, index) => (
            <div key={row.internalStatusId} className="grid gap-2 sm:grid-cols-2">
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={row.internalStatusName ?? row.internalStatusId}
                readOnly
              />
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={row.externalStatusId}
                placeholder="ID статуса в CRM"
                onChange={(e) => {
                  const nextMappings = [...statusMapping.mappings];
                  nextMappings[index] = {
                    ...row,
                    externalStatusId: e.target.value,
                  };
                  onChange({ ...statusMapping, mappings: nextMappings });
                }}
              />
            </div>
          ))}
        </>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <button
        type="button"
        disabled={saving || incomplete}
        onClick={onSave}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {saving ? 'Сохранение…' : 'Сохранить синхронизацию статусов'}
      </button>
    </div>
  );
}

export function CrmIntegrationCard({
  provider,
  connected,
  onChanged,
  syncErrors,
}: {
  provider: 'amocrm' | 'bitrix24';
  connected: boolean;
  onChanged: () => void;
  syncErrors: Array<{ leadId: string | null; errorMessage: string | null }>;
}) {
  const [mappings, setMappings] = useState<FieldMappingItem[]>([]);
  const [statusMapping, setStatusMapping] =
    useState<CrmStatusMappingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const label = provider === 'amocrm' ? 'amoCRM' : 'Bitrix24';

  useEffect(() => {
    if (!connected) return;
    setLoading(true);
    const fieldLoader =
      provider === 'amocrm' ? fetchAmocrmFieldMapping : fetchBitrixFieldMapping;
    const statusLoader =
      provider === 'amocrm'
        ? fetchAmocrmStatusMapping
        : fetchBitrixStatusMapping;
    Promise.all([fieldLoader(), statusLoader()])
      .then(([fields, statuses]) => {
        setMappings(fields);
        setStatusMapping(statuses);
      })
      .finally(() => setLoading(false));
  }, [connected, provider]);

  const connect = async () => {
    try {
      const url =
        provider === 'amocrm'
          ? await getAmocrmConnectUrl()
          : await getBitrixConnectUrl();
      window.location.href = url;
    } catch {
      if (provider === 'amocrm') await mockConnectAmocrm();
      else await mockConnectBitrix24();
      onChanged();
    }
  };

  const disconnect = async () => {
    if (provider === 'amocrm') await disconnectAmocrm();
    else await disconnectBitrix24();
    onChanged();
  };

  const saveMapping = async () => {
    setSaving(true);
    try {
      const saved =
        provider === 'amocrm'
          ? await saveAmocrmFieldMapping(mappings)
          : await saveBitrixFieldMapping(mappings);
      setMappings(saved);
    } finally {
      setSaving(false);
    }
  };

  const saveStatusMapping = async () => {
    if (!statusMapping) return;
    setSavingStatus(true);
    setStatusError(null);
    const payload: SaveStatusMappingDto = {
      bidirectionalSync: statusMapping.bidirectionalSync,
      mappings: statusMapping.mappings.map((row) => ({
        internalStatusId: row.internalStatusId,
        externalStatusId: row.externalStatusId,
      })),
    };
    try {
      const saved =
        provider === 'amocrm'
          ? await saveAmocrmStatusMapping(payload)
          : await saveBitrixStatusMapping(payload);
      setStatusMapping(saved);
    } catch (err: unknown) {
      const message =
        err &&
        typeof err === 'object' &&
        'response' in err &&
        err.response &&
        typeof err.response === 'object' &&
        'data' in err.response &&
        err.response.data &&
        typeof err.response.data === 'object' &&
        'message' in err.response.data
          ? String(err.response.data.message)
          : 'Не удалось сохранить маппинг статусов';
      setStatusError(message);
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{label}</h2>
          <p className="text-sm text-slate-500">
            Статус: {connected ? 'Подключено' : 'Не подключено'}
          </p>
        </div>
        <div className="flex gap-2">
          {connected ? (
            <button
              type="button"
              onClick={disconnect}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
            >
              Отключить
            </button>
          ) : (
            <button
              type="button"
              onClick={connect}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Подключить
            </button>
          )}
        </div>
      </div>

      {connected && !loading && mappings.length > 0 && (
        <FieldMappingEditor
          title="Маппинг полей"
          mappings={mappings}
          onChange={setMappings}
          onSave={saveMapping}
          saving={saving}
        />
      )}

      {connected && !loading && statusMapping && (
        <StatusMappingEditor
          statusMapping={statusMapping}
          onChange={setStatusMapping}
          onSave={saveStatusMapping}
          saving={savingStatus}
          error={statusError}
        />
      )}

      {syncErrors.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900">Ошибки синхронизации</p>
          <ul className="mt-2 space-y-2">
            {syncErrors.map((item) => (
              <li
                key={`${item.leadId}-${item.errorMessage}`}
                className="flex items-center justify-between gap-2"
              >
                <span className="text-amber-800">
                  {item.errorMessage ?? 'Ошибка экспорта'}
                </span>
                {item.leadId && (
                  <button
                    type="button"
                    onClick={() => retryCrmSync(item.leadId!).then(onChanged)}
                    className="text-amber-900 underline"
                  >
                    Повторить
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
