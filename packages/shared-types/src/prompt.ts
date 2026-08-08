export interface PromptDto {
  id: string;
  tenantId: string | null;
  scope: 'global' | 'tenant';
  content: string;
  version: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface PlaygroundTestRequest {
  sourceId: string;
  message: string;
  clientPrompt: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface PlaygroundTestResponse {
  content: string;
  provider: string;
  model: string;
  isSuspicious: boolean;
  retrieval?: import('./retrieval').RetrievalDiagnosticDto;
}

export interface GeneratePromptFromUrlsRequest {
  sourceId: string;
  urls: string[];
}

export interface GeneratePromptFromUrlsResponse {
  content: string;
  charLimit: number;
  provider: string;
  model: string;
  pages: Array<{ url: string; title: string }>;
  errors: Array<{ url: string; error: string }>;
}

export interface LeadExtractDto {
  id: string;
  tenantId: string;
  dialogId: string;
  sourceId: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
}
