import { useEffect, useState } from 'react';
import type { OutgoingWebhookEvent } from '@ai-consultant/shared-types';
import {
  fetchOutgoingWebhook,
  generateOutgoingWebhookSecret,
  saveOutgoingWebhook,
} from '../lib/integrations';
import { extractErrorMessage } from '../lib/errors';
import { showToast } from './Toast';

const EVENT_LABELS: Record<OutgoingWebhookEvent, string> = {
  'lead.created': 'Новый лид',
  'dialog.closed': 'Диалог закрыт',
};

export function OutgoingWebhookSection() {
  const [url, setUrl] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [events, setEvents] = useState<OutgoingWebhookEvent[]>([
    'lead.created',
    'dialog.closed',
  ]);
  const [hasSecret, setHasSecret] = useState(false);
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const config = await fetchOutgoingWebhook();
      setUrl(config.url);
      setEnabled(config.enabled);
      setEvents(config.events);
      setHasSecret(config.hasSecret);
    } catch (err: unknown) {
      showToast(extractErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleEvent = (event: OutgoingWebhookEvent) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const handleGenerateSecret = async () => {
    try {
      const value = await generateOutgoingWebhookSecret();
      setSecret(value);
      setHasSecret(true);
      showToast('Секрет сгенерирован — сохраните настройки', 'success');
    } catch (err: unknown) {
      showToast(extractErrorMessage(err), 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const config = await saveOutgoingWebhook({
        url,
        enabled,
        events,
        ...(secret ? { secret } : {}),
      });
      setHasSecret(config.hasSecret);
      setSecret('');
      showToast('Webhook сохранён', 'success');
    } catch (err: unknown) {
      showToast(extractErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Загрузка webhook…</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Исходящий webhook</h2>
      <p className="mt-1 text-sm text-slate-500">
        POST-запросы на ваш URL с подписью HMAC в заголовке{' '}
        <code className="text-xs">X-AICW-Signature: sha256=…</code>
      </p>

      <div className="mt-4 space-y-4">
        <label className="block text-sm">
          <span className="text-slate-700">URL</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhooks/aicw"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Включить webhook
        </label>

        <div className="flex flex-wrap gap-4 text-sm">
          {(Object.keys(EVENT_LABELS) as OutgoingWebhookEvent[]).map((event) => (
            <label key={event} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={events.includes(event)}
                onChange={() => toggleEvent(event)}
              />
              {EVENT_LABELS[event]}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="block flex-1 text-sm">
            <span className="text-slate-700">Секрет HMAC</span>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={hasSecret ? 'Секрет сохранён' : 'Сгенерируйте или введите'}
            />
          </label>
          <button
            type="button"
            onClick={() => void handleGenerateSecret()}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Сгенерировать
          </button>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'Сохранение…' : 'Сохранить webhook'}
        </button>
      </div>
    </section>
  );
}
