import { api } from './api';
import { withRetry } from './retry';
import type {
  CreateLeadDeliveryChannelDto,
  LeadDeliveryChannelDto,
  LeadDeliveryLogDto,
  UpdateLeadDeliveryChannelDto,
  ValidateTelegramDto,
  ValidateTelegramResponse,
} from '@ai-consultant/shared-types';

export async function fetchLeadDeliveryChannels() {
  return withRetry(() =>
    api
      .get<LeadDeliveryChannelDto[]>('/integrations/lead-delivery')
      .then((r) => r.data),
  );
}

export async function fetchLeadDeliveryLogs(limit = 30) {
  return withRetry(() =>
    api
      .get<LeadDeliveryLogDto[]>(`/integrations/lead-delivery/logs?limit=${limit}`)
      .then((r) => r.data),
  );
}

export async function createLeadDeliveryChannel(data: CreateLeadDeliveryChannelDto) {
  const res = await api.post<LeadDeliveryChannelDto>(
    '/integrations/lead-delivery',
    data,
  );
  return res.data;
}

export async function updateLeadDeliveryChannel(
  id: string,
  data: UpdateLeadDeliveryChannelDto,
) {
  const res = await api.patch<LeadDeliveryChannelDto>(
    `/integrations/lead-delivery/${id}`,
    data,
  );
  return res.data;
}

export async function deleteLeadDeliveryChannel(id: string) {
  await api.delete(`/integrations/lead-delivery/${id}`);
}

export async function validateTelegramBot(data: ValidateTelegramDto) {
  const res = await api.post<ValidateTelegramResponse>(
    '/integrations/lead-delivery/validate/telegram',
    data,
  );
  return res.data;
}

export async function sendLeadDeliveryTest(channelId: string) {
  const res = await api.post<{ ok: boolean }>(
    `/integrations/lead-delivery/${channelId}/test`,
  );
  return res.data;
}

export async function getGoogleSheetsConnectUrl(channelId: string) {
  const res = await api.get<{ url: string }>(
    `/integrations/lead-delivery/google-sheets/${channelId}/connect-url`,
  );
  return res.data.url;
}

export async function mockConnectGoogleSheets(channelId: string) {
  const res = await api.post<LeadDeliveryChannelDto>(
    `/integrations/lead-delivery/google-sheets/${channelId}/mock-connect`,
  );
  return res.data;
}
