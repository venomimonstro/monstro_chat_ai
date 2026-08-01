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
