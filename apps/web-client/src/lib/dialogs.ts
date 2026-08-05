import { api } from './api';
import { withRetry } from './retry';

export interface DialogListItemDto {
  id: string;
  sourceId: string;
  sourceName: string | null;
  visitorId: string;
  status: 'active' | 'closed';
  startedAt: string;
  updatedAt: string;
  endedAt: string | null;
  messageCount: number;
  visitorDialogCount: number;
  hasLead: boolean;
  lead: { id: string; name: string | null; phone: string | null } | null;
  lastMessage: {
    role: string;
    content: string;
    createdAt: string;
  } | null;
}

export interface DialogDetailDto {
  id: string;
  sourceId: string;
  sourceName: string | null;
  visitorId: string;
  status: 'active' | 'closed';
  summary: string | null;
  startedAt: string;
  updatedAt: string;
  endedAt: string | null;
  referrer: string | null;
  landingPage: string | null;
  messageCount: number;
  isReturningVisitor: boolean;
  priorDialogCount: number;
  hasLead: boolean;
  lead: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

export interface DialogMessageDto {
  id: string;
  role: 'user' | 'assistant' | 'manager';
  content: string;
  createdAt: string;
  provider?: string | null;
  model?: string | null;
  feedbackRating?: 'up' | 'down' | null;
}

export interface DialogListResponse {
  items: DialogListItemDto[];
  nextCursor: string | null;
}

export async function fetchDialogs(params?: Record<string, string>) {
  return withRetry(() =>
    api.get<DialogListResponse>('/dialogs', { params }).then((r) => r.data),
  );
}

export async function fetchDialog(id: string) {
  return withRetry(() => api.get<DialogDetailDto>(`/dialogs/${id}`).then((r) => r.data));
}

export async function fetchDialogMessages(id: string) {
  return withRetry(() =>
    api.get<DialogMessageDto[]>(`/dialogs/${id}/messages`).then((r) => r.data),
  );
}

export async function downloadDialogTranscript(id: string) {
  const res = await api.get(`/dialogs/${id}/export`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `dialog-${id.slice(0, 8)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}
