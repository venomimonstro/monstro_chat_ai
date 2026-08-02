import { io, Socket } from 'socket.io-client';
import { api, fetchWsToken } from './api';

export interface KnowledgeDocumentDto {
  id: string;
  tenantId: string;
  jobId: string | null;
  sourceId: string | null;
  type: 'site_page' | 'file';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'excluded';
  title: string | null;
  url: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  errorMessage: string | null;
  indexedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IndexingJobDto {
  id: string;
  tenantId: string;
  sourceId: string | null;
  type: 'crawl' | 'ingest';
  status: 'queued' | 'running' | 'completed' | 'failed';
  rootUrl: string | null;
  totalPages: number;
  processedPages: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface IndexingProgressEvent {
  tenantId: string;
  jobId: string;
  processed: number;
  total: number;
  status?: string;
}

export async function startCrawl(sourceId: string, url: string) {
  const res = await api.post<IndexingJobDto>('/knowledge/crawl', {
    sourceId,
    url,
  });
  return res.data;
}

export async function fetchDocuments(sourceId: string) {
  const res = await api.get<KnowledgeDocumentDto[]>('/knowledge/documents', {
    params: { sourceId },
  });
  return res.data;
}

export async function fetchJobs(sourceId: string) {
  const res = await api.get<IndexingJobDto[]>('/knowledge/jobs', {
    params: { sourceId },
  });
  return res.data;
}

export async function uploadDocument(sourceId: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<KnowledgeDocumentDto>(
    `/knowledge/documents?sourceId=${encodeURIComponent(sourceId)}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return res.data;
}

export async function deleteDocument(documentId: string) {
  await api.delete(`/knowledge/documents/${documentId}`);
}

export async function excludeDocument(documentId: string) {
  const res = await api.patch<KnowledgeDocumentDto>(
    `/knowledge/documents/${documentId}/exclude`,
  );
  return res.data;
}

export async function addManualText(
  sourceId: string,
  title: string,
  content: string,
) {
  const res = await api.post<KnowledgeDocumentDto>('/knowledge/text', {
    sourceId,
    title,
    content,
  });
  return res.data;
}

export async function getManualText(documentId: string) {
  const res = await api.get<{ document: KnowledgeDocumentDto; content: string }>(
    `/knowledge/text/${documentId}`,
  );
  return res.data;
}

export async function updateManualText(
  documentId: string,
  content: string,
  title?: string,
) {
  const res = await api.patch<KnowledgeDocumentDto>(
    `/knowledge/text/${documentId}`,
    { content, title },
  );
  return res.data;
}

export function connectIndexingSocket(
  onProgress: (event: IndexingProgressEvent) => void,
): () => void {
  let client: Socket | null = null;
  let cancelled = false;

  void fetchWsToken().then((token) => {
    if (!token || cancelled) return;

    client = io('/indexing', {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    client.on('indexing:progress', onProgress);
  });

  return () => {
    cancelled = true;
    if (client) {
      client.off('indexing:progress', onProgress);
      client.disconnect();
    }
  };
}
