import type { AttributionDto, LeadSyncStatus } from './integrations';
export type { AttributionDto, LeadSyncStatus };

export interface PipelineStatusDto {
  id: string;
  pipelineId: string;
  name: string;
  sortOrder: number;
  color: string;
}

export interface PipelineDto {
  id: string;
  tenantId: string;
  name: string;
  isDefault: boolean;
  statuses: PipelineStatusDto[];
  createdAt: string;
}

export interface LeadDto {
  id: string;
  tenantId: string;
  dialogId: string;
  sourceId: string | null;
  pipelineId: string | null;
  statusId: string | null;
  assignedUserId: string | null;
  mergedIntoId: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  attribution?: AttributionDto | null;
  externalId?: string | null;
  externalCrmType?: string | null;
  syncStatus?: LeadSyncStatus | null;
  syncError?: string | null;
  lastSyncAt?: string | null;
  tags: string[];
  notes: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  status?: PipelineStatusDto | null;
  assignedUser?: { id: string; email: string } | null;
  source?: { id: string; name: string } | null;
}

export interface LeadStatusHistoryDto {
  id: string;
  leadId: string;
  fromStatusId: string | null;
  toStatusId: string;
  changedById: string | null;
  createdAt: string;
  fromStatus?: PipelineStatusDto | null;
  toStatus?: PipelineStatusDto;
}

export interface TenantUserDto {
  id: string;
  email: string;
  role: string;
}

export interface DuplicateLeadSuggestion {
  leadId: string;
  name: string | null;
  phone: string | null;
  createdAt: string;
}
