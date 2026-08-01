import { api } from './api';

export async function connectTelegramChannel(sourceId: string, botToken: string) {
  const res = await api.post(`/channels/telegram/${sourceId}/connect`, { botToken });
  return res.data;
}

export async function connectVkChannel(
  sourceId: string,
  data: { groupId: number; accessToken: string; confirmationCode: string },
) {
  const res = await api.post(`/channels/vk/${sourceId}/connect`, data);
  return res.data;
}
