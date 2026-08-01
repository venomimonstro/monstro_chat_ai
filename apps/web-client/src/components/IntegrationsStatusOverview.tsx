import { useEffect, useState } from 'react';
import type {
  IntegrationsOverviewDto,
  LeadDeliveryChannelDto,
} from '@ai-consultant/shared-types';
import { fetchIntegrations } from '../lib/integrations';
import { fetchLeadDeliveryChannels } from '../lib/lead-delivery';
import { SkeletonGrid } from './Skeleton';

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`}
      />
      {label}
    </span>
  );
}

export function IntegrationsStatusOverview() {
  const [overview, setOverview] = useState<IntegrationsOverviewDto | null>(null);
  const [channels, setChannels] = useState<LeadDeliveryChannelDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchIntegrations(),
      fetchLeadDeliveryChannels().catch(() => []),
    ])
      .then(([data, ch]) => {
        setOverview(data);
        setChannels(ch);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonGrid count={4} />;

  const deliveryActive = channels.filter((c) => c.enabled).length;

  const items = [
    {
      label: 'amoCRM',
      active: overview?.amocrm?.status === 'active',
      href: '#amocrm',
    },
    {
      label: 'Bitrix24',
      active: overview?.bitrix24?.status === 'active',
      href: '#bitrix24',
    },
    {
      label: 'Метрика',
      active: overview?.metrika?.status === 'active',
    },
    {
      label: 'GA4',
      active: overview?.ga4?.status === 'active',
    },
    {
      label: 'GTM',
      active: overview?.gtm?.status === 'active',
    },
    {
      label: 'Доставка лидов',
      active: deliveryActive > 0,
      detail: deliveryActive ? `${deliveryActive} кан.` : undefined,
    },
  ];

  return (
    <div className="lk-card">
      <h2 className="text-lg font-semibold text-slate-900">Статус подключений</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3"
          >
            <span className="text-sm font-medium text-slate-800">{item.label}</span>
            <div className="flex items-center gap-2">
              {item.detail ? (
                <span className="text-xs text-slate-500">{item.detail}</span>
              ) : null}
              <StatusPill active={item.active} label={item.active ? 'Активно' : 'Выкл.'} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
