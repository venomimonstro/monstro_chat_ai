import { api } from './api';
import type { PromptDto } from '@ai-consultant/shared-types';

export async function fetchGlobalPromptHistory() {
  const res = await api.get<PromptDto[]>('/prompts', { params: { scope: 'global' } });
  return res.data;
}

export async function fetchActiveGlobalPrompt() {
  const res = await api.get<PromptDto | null>('/prompts/active', {
    params: { scope: 'global' },
  });
  return res.data;
}

export async function saveGlobalPrompt(content: string) {
  const res = await api.post<PromptDto>('/prompts', { content, scope: 'global' });
  return res.data;
}

export async function activateGlobalPrompt(id: string) {
  const res = await api.post<PromptDto>(`/prompts/${id}/activate`);
  return res.data;
}
