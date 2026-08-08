import { api } from './api';
import type {
  PlaygroundTestRequest,
  PlaygroundTestResponse,
  PromptDto,
} from '@ai-consultant/shared-types';

export async function fetchPromptHistory(scope: 'tenant' | 'global' = 'tenant') {
  const res = await api.get<PromptDto[]>('/prompts', { params: { scope } });
  return res.data;
}

export async function fetchActivePrompt(scope: 'tenant' | 'global' = 'tenant') {
  const res = await api.get<PromptDto | null>('/prompts/active', {
    params: { scope },
  });
  return res.data;
}

export async function fetchPromptCharLimit() {
  const res = await api.get<number>('/prompts/limits');
  return res.data;
}

export async function savePrompt(content: string, scope: 'tenant' | 'global' = 'tenant') {
  const res = await api.post<PromptDto>('/prompts', { content, scope });
  return res.data;
}

export async function activatePrompt(id: string) {
  const res = await api.post<PromptDto>(`/prompts/${id}/activate`);
  return res.data;
}

export async function testPlayground(data: PlaygroundTestRequest) {
  const res = await api.post<PlaygroundTestResponse>(
    '/prompts/playground/test',
    data,
  );
  return res.data;
}

export async function generatePromptFromUrls(
  data: import('@ai-consultant/shared-types').GeneratePromptFromUrlsRequest,
) {
  const res = await api.post<
    import('@ai-consultant/shared-types').GeneratePromptFromUrlsResponse
  >('/prompts/generate-from-urls', data);
  return res.data;
}

export async function fetchPromptExperiments() {
  const res = await api.get<import('@ai-consultant/shared-types').PromptExperimentDto[]>(
    '/prompts/experiments',
  );
  return res.data;
}

export async function createPromptExperiment(
  data: import('@ai-consultant/shared-types').CreatePromptExperimentDto,
) {
  const res = await api.post<import('@ai-consultant/shared-types').PromptExperimentDto>(
    '/prompts/experiments',
    data,
  );
  return res.data;
}

export async function startPromptExperiment(id: string) {
  const res = await api.post<import('@ai-consultant/shared-types').PromptExperimentDto>(
    `/prompts/experiments/${id}/start`,
  );
  return res.data;
}

export async function pausePromptExperiment(id: string) {
  const res = await api.post<import('@ai-consultant/shared-types').PromptExperimentDto>(
    `/prompts/experiments/${id}/pause`,
  );
  return res.data;
}

export async function fetchPromptExperimentReport(id: string, days = 7) {
  const res = await api.get<import('@ai-consultant/shared-types').PromptExperimentReportDto>(
    `/prompts/experiments/${id}/report`,
    { params: { days } },
  );
  return res.data;
}
