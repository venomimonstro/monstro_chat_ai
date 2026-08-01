import { api } from './api';
import { withRetry } from './retry';
import type {
  CrmStatusMappingResponse,
  CrmSyncErrorDto,
  FieldMappingItem,
  IntegrationDto,
  IntegrationsOverviewDto,
  SaveFieldMappingDto,
  SaveStatusMappingDto,
  UpsertGa4IntegrationDto,
  UpsertGtmIntegrationDto,
  UpsertMetrikaIntegrationDto,
} from '@ai-consultant/shared-types';

export async function fetchIntegrations() {
  return withRetry(() => api.get<IntegrationsOverviewDto>('/integrations').then((r) => r.data));
}

export async function fetchCrmSyncErrors() {
  return withRetry(() =>
    api.get<CrmSyncErrorDto[]>('/integrations/crm/sync-errors').then((r) => r.data),
  );
}

export async function retryCrmSync(leadId: string) {
  await api.post(`/integrations/crm/retry/${leadId}`);
}

export async function getAmocrmConnectUrl() {
  const res = await api.get<{ url: string }>('/integrations/amocrm/connect-url');
  return res.data.url;
}

export async function mockConnectAmocrm() {
  await api.post('/integrations/amocrm/mock-connect');
}

export async function disconnectAmocrm() {
  await api.delete('/integrations/amocrm');
}

export async function fetchAmocrmFieldMapping() {
  const res = await api.get<FieldMappingItem[]>('/integrations/amocrm/field-mapping');
  return res.data;
}

export async function saveAmocrmFieldMapping(mappings: FieldMappingItem[]) {
  const res = await api.put<FieldMappingItem[]>(
    '/integrations/amocrm/field-mapping',
    { mappings } satisfies SaveFieldMappingDto,
  );
  return res.data;
}

export async function getBitrixConnectUrl() {
  const res = await api.get<{ url: string }>('/integrations/bitrix24/connect-url');
  return res.data.url;
}

export async function mockConnectBitrix24() {
  await api.post('/integrations/bitrix24/mock-connect');
}

export async function disconnectBitrix24() {
  await api.delete('/integrations/bitrix24');
}

export async function fetchBitrixFieldMapping() {
  const res = await api.get<FieldMappingItem[]>('/integrations/bitrix24/field-mapping');
  return res.data;
}

export async function saveBitrixFieldMapping(mappings: FieldMappingItem[]) {
  const res = await api.put<FieldMappingItem[]>(
    '/integrations/bitrix24/field-mapping',
    { mappings } satisfies SaveFieldMappingDto,
  );
  return res.data;
}

export async function fetchAmocrmStatusMapping() {
  const res = await api.get<CrmStatusMappingResponse>(
    '/integrations/amocrm/status-mapping',
  );
  return res.data;
}

export async function saveAmocrmStatusMapping(data: SaveStatusMappingDto) {
  const res = await api.put<CrmStatusMappingResponse>(
    '/integrations/amocrm/status-mapping',
    data,
  );
  return res.data;
}

export async function fetchBitrixStatusMapping() {
  const res = await api.get<CrmStatusMappingResponse>(
    '/integrations/bitrix24/status-mapping',
  );
  return res.data;
}

export async function saveBitrixStatusMapping(data: SaveStatusMappingDto) {
  const res = await api.put<CrmStatusMappingResponse>(
    '/integrations/bitrix24/status-mapping',
    data,
  );
  return res.data;
}

export async function saveMetrikaIntegration(data: UpsertMetrikaIntegrationDto) {
  const res = await api.put<IntegrationDto>('/integrations/metrika', data);
  return res.data;
}

export async function saveGtmIntegration(data: UpsertGtmIntegrationDto) {
  const res = await api.put<IntegrationDto>('/integrations/gtm', data);
  return res.data;
}

export async function saveGa4Integration(data: UpsertGa4IntegrationDto) {
  const res = await api.put<IntegrationDto>('/integrations/ga4', data);
  return res.data;
}

export async function fetchOutgoingWebhook() {
  const res = await api.get<import('@ai-consultant/shared-types').OutgoingWebhookDto>(
    '/integrations/outgoing-webhook',
  );
  return res.data;
}

export async function saveOutgoingWebhook(
  data: import('@ai-consultant/shared-types').SaveOutgoingWebhookDto,
) {
  const res = await api.post<import('@ai-consultant/shared-types').OutgoingWebhookDto>(
    '/integrations/outgoing-webhook',
    data,
  );
  return res.data;
}

export async function generateOutgoingWebhookSecret() {
  const res = await api.post<{ secret: string }>(
    '/integrations/outgoing-webhook/generate-secret',
  );
  return res.data.secret;
}
