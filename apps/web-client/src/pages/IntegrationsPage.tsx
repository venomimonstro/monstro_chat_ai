import { useEffect, useState } from 'react';
import type {
  Ga4IntegrationConfig,
  GtmIntegrationConfig,
  IntegrationsOverviewDto,
  MetrikaIntegrationConfig,
} from '@ai-consultant/shared-types';
import {
  fetchIntegrations,
  fetchCrmSyncErrors,
  saveGa4Integration,
  saveGtmIntegration,
  saveMetrikaIntegration,
} from '../lib/integrations';
import { CrmIntegrationCard } from '../components/CrmIntegrationCard';
import { LeadDeliverySection } from '../components/LeadDeliverySection';
import { OutgoingWebhookSection } from '../components/OutgoingWebhookSection';
import type { CrmSyncErrorDto } from '@ai-consultant/shared-types';
import { extractErrorMessage } from '../lib/errors';
import { IntegrationsStatusOverview } from '../components/IntegrationsStatusOverview';
import { ErrorState, LoadingState } from '../components/EmptyState';

export function IntegrationsPage() {
  const [overview, setOverview] = useState<IntegrationsOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    kind: 'success' | 'error';
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const metrika = (overview?.metrika?.config ?? {}) as MetrikaIntegrationConfig;
  const ga4 = (overview?.ga4?.config ?? {}) as Ga4IntegrationConfig;

  const [metrikaCounterId, setMetrikaCounterId] = useState('');
  const [metrikaToken, setMetrikaToken] = useState('');
  const [metrikaLeadCreated, setMetrikaLeadCreated] = useState(true);
  const [metrikaDealWon, setMetrikaDealWon] = useState(true);

  const [gtmContainerId, setGtmContainerId] = useState('');

  const [ga4MeasurementId, setGa4MeasurementId] = useState('');
  const [ga4ApiSecret, setGa4ApiSecret] = useState('');
  const [ga4LeadCreated, setGa4LeadCreated] = useState(true);
  const [ga4DealWon, setGa4DealWon] = useState(true);
  const [syncErrors, setSyncErrors] = useState<CrmSyncErrorDto[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, errors] = await Promise.all([
        fetchIntegrations(),
        fetchCrmSyncErrors().catch(() => []),
      ]);
      setOverview(data);
      setSyncErrors(errors);
      const m = (data.metrika?.config ?? {}) as MetrikaIntegrationConfig;
      const g = (data.gtm?.config ?? {}) as GtmIntegrationConfig;
      const a = (data.ga4?.config ?? {}) as Ga4IntegrationConfig;
      setMetrikaCounterId(m.counterId ?? '');
      setMetrikaLeadCreated(m.events?.leadCreated ?? true);
      setMetrikaDealWon(m.events?.dealWon ?? true);
      setGtmContainerId(g.containerId ?? '');
      setGa4MeasurementId(a.measurementId ?? '');
      setGa4LeadCreated(a.events?.leadCreated ?? true);
      setGa4DealWon(a.events?.dealWon ?? true);
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSaveMetrika = async () => {
    setSaving('metrika');
    setMessage(null);
    try {
      await saveMetrikaIntegration({
        counterId: metrikaCounterId,
        oauthToken: metrikaToken || undefined,
        status: 'active',
        events: {
          leadCreated: metrikaLeadCreated,
          dealWon: metrikaDealWon,
        },
      });
      setMetrikaToken('');
      setMessage({ text: 'Настройки Яндекс.Метрики сохранены', kind: 'success' });
      await load();
    } catch (err: unknown) {
      setMessage({ text: extractErrorMessage(err), kind: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const handleSaveGtm = async () => {
    setSaving('gtm');
    setMessage(null);
    try {
      await saveGtmIntegration({
        containerId: gtmContainerId,
        status: 'active',
      });
      setMessage({ text: 'Настройки GTM сохранены', kind: 'success' });
      await load();
    } catch (err: unknown) {
      setMessage({ text: extractErrorMessage(err), kind: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const handleSaveGa4 = async () => {
    setSaving('ga4');
    setMessage(null);
    try {
      await saveGa4Integration({
        measurementId: ga4MeasurementId,
        apiSecret: ga4ApiSecret,
        status: 'active',
        events: {
          leadCreated: ga4LeadCreated,
          dealWon: ga4DealWon,
        },
      });
      setGa4ApiSecret('');
      setMessage({ text: 'Настройки GA4 сохранены', kind: 'success' });
      await load();
    } catch (err: unknown) {
      setMessage({ text: extractErrorMessage(err), kind: 'error' });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <LoadingState message="Загрузка интеграций…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Интеграции</h1>
        <p className="mt-1 text-slate-500">
          CRM, аналитика, UTM-трекинг и офлайн-конверсии
        </p>
        {message && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              message.kind === 'success'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </p>
        )}
      </div>

      <IntegrationsStatusOverview />

      <CrmIntegrationCard
        provider="amocrm"
        connected={overview?.amocrm?.status === 'active'}
        onChanged={load}
        syncErrors={syncErrors.filter((e) => e.integrationType === 'amocrm')}
      />

      <CrmIntegrationCard
        provider="bitrix24"
        connected={overview?.bitrix24?.status === 'active'}
        onChanged={load}
        syncErrors={syncErrors.filter((e) => e.integrationType === 'bitrix24')}
      />

      <LeadDeliverySection
        onMessage={(text) =>
          setMessage({
            text,
            kind: /ошибк|не удал/i.test(text) ? 'error' : 'success',
          })
        }
      />

      <OutgoingWebhookSection />

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Яндекс.Метрика
          </h2>
          <p className="text-sm text-slate-500">
            Статус:{' '}
            {overview?.metrika?.status === 'active' ? 'Активно' : 'Не настроено'}
          </p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-700">Номер счётчика</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={metrikaCounterId}
              onChange={(e) => setMetrikaCounterId(e.target.value)}
              placeholder="12345678"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">
              OAuth-токен (для офлайн-конверсий)
            </span>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={metrikaToken}
              onChange={(e) => setMetrikaToken(e.target.value)}
              placeholder={metrika.oauthToken ? 'Токен сохранён' : 'y0_AgA...'}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={metrikaLeadCreated}
              onChange={(e) => setMetrikaLeadCreated(e.target.checked)}
            />
            Отправлять lead_created
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={metrikaDealWon}
              onChange={(e) => setMetrikaDealWon(e.target.checked)}
            />
            Отправлять deal_won
          </label>
        </div>
        <button
          type="button"
          disabled={saving === 'metrika'}
          onClick={handleSaveMetrika}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving === 'metrika' ? 'Сохранение…' : 'Сохранить'}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Google Tag Manager</h2>
        <p className="text-sm text-slate-500">
          Статус: {overview?.gtm?.status === 'active' ? 'Активно' : 'Не настроено'}
        </p>
        <label className="mt-4 block max-w-md text-sm">
          <span className="text-slate-700">ID контейнера</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={gtmContainerId}
            onChange={(e) => setGtmContainerId(e.target.value)}
            placeholder="GTM-XXXXXX"
          />
        </label>
        <button
          type="button"
          disabled={saving === 'gtm'}
          onClick={handleSaveGtm}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving === 'gtm' ? 'Сохранение…' : 'Сохранить'}
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Google Analytics 4</h2>
        <p className="text-sm text-slate-500">
          Measurement Protocol для офлайн-событий
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-700">Measurement ID</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={ga4MeasurementId}
              onChange={(e) => setGa4MeasurementId(e.target.value)}
              placeholder="G-XXXXXXXX"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">API Secret</span>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={ga4ApiSecret}
              onChange={(e) => setGa4ApiSecret(e.target.value)}
              placeholder={ga4.apiSecret ? 'Секрет сохранён' : 'secret_...'}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ga4LeadCreated}
              onChange={(e) => setGa4LeadCreated(e.target.checked)}
            />
            Отправлять lead_created
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ga4DealWon}
              onChange={(e) => setGa4DealWon(e.target.checked)}
            />
            Отправлять deal_won
          </label>
        </div>
        <button
          type="button"
          disabled={saving === 'ga4'}
          onClick={handleSaveGa4}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving === 'ga4' ? 'Сохранение…' : 'Сохранить'}
        </button>
      </section>
    </div>
  );
}
