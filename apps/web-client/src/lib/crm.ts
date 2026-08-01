import { api } from './api';
import { withRetry } from './retry';
import type {
  LeadDto,
  PipelineDto,
  LeadStatusHistoryDto,
  TenantUserDto,
  DuplicateLeadSuggestion,
} from '@ai-consultant/shared-types';

export async function fetchPipelines() {
  return withRetry(() => api.get<PipelineDto[]>('/pipelines').then((r) => r.data));
}

export async function fetchLeads(params?: Record<string, string>) {
  return withRetry(() => api.get<LeadDto[]>('/leads', { params }).then((r) => r.data));
}

export async function fetchLead(id: string) {
  return withRetry(() => api.get<LeadDto>(`/leads/${id}`).then((r) => r.data));
}

export async function fetchLeadHistory(id: string) {
  return withRetry(() => api.get<LeadStatusHistoryDto[]>(`/leads/${id}/history`).then((r) => r.data));
}

export async function fetchLeadMessages(id: string) {
  return withRetry(() =>
    api.get<Array<{ id: string; role: string; content: string; createdAt: string }>>(
      `/leads/${id}/messages`,
    ).then((r) => r.data),
  );
}

export async function fetchTenantUsers() {
  return withRetry(() => api.get<TenantUserDto[]>('/leads/users').then((r) => r.data));
}

export async function updateLeadStatus(leadId: string, statusId: string) {
  const res = await api.patch<LeadDto>(`/leads/${leadId}/status`, { statusId });
  return res.data;
}

export async function assignLead(leadId: string, assignedUserId: string | null) {
  const res = await api.patch<LeadDto>(`/leads/${leadId}/assign`, {
    assignedUserId,
  });
  return res.data;
}

export async function updateLeadNotes(leadId: string, notes: string) {
  const res = await api.patch<LeadDto>(`/leads/${leadId}/notes`, { notes });
  return res.data;
}

export async function mergeLeads(sourceId: string, targetId: string) {
  const res = await api.post<LeadDto>(`/leads/${sourceId}/merge/${targetId}`);
  return res.data;
}

export async function createPipelineStatus(
  pipelineId: string,
  data: { name: string; color?: string },
) {
  const res = await api.post(`/pipelines/${pipelineId}/statuses`, data);
  return res.data;
}

export async function deletePipelineStatus(statusId: string) {
  await api.delete(`/pipelines/statuses/${statusId}`);
}

export async function archiveLeads(leadIds: string[]) {
  const res = await api.post<{ archived: number }>('/leads/archive', { leadIds });
  return res.data;
}

export async function findDuplicateLeads(phone: string) {
  const res = await api.get<DuplicateLeadSuggestion[]>('/leads/duplicates', {
    params: { phone },
  });
  return res.data;
}
