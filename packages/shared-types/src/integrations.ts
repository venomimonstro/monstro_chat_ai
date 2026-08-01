export type IntegrationType = 'metrika' | 'gtm' | 'ga4' | 'amocrm' | 'bitrix24';

export type IntegrationStatus = 'active' | 'inactive';

export interface AttributionDto {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  referrer?: string | null;
  landingPage?: string | null;
  yandexClientId?: string | null;
  gaClientId?: string | null;
}

export interface ConversionEventsConfig {
  leadCreated: boolean;
  dealWon: boolean;
}

export interface MetrikaIntegrationConfig {
  counterId?: string;
  oauthToken?: string;
  events?: ConversionEventsConfig;
  dealWonStatusNames?: string[];
  eventMapping?: Record<string, string>;
}

export interface GtmIntegrationConfig {
  containerId?: string;
}

export interface Ga4IntegrationConfig {
  measurementId?: string;
  apiSecret?: string;
  events?: ConversionEventsConfig;
  dealWonStatusNames?: string[];
  eventMapping?: Record<string, string>;
}

export interface CrmIntegrationConfig {
  accountDomain?: string;
  portalDomain?: string;
  mock?: boolean;
  bidirectionalSync?: boolean;
  webhookSecret?: string;
}

export interface StatusMappingItem {
  internalStatusId: string;
  internalStatusName?: string;
  externalStatusId: string;
}

export interface CrmStatusMappingResponse {
  bidirectionalSync: boolean;
  webhookUrl: string;
  webhookSecret: string | null;
  pipelineStatuses: Array<{
    id: string;
    name: string;
    sortOrder: number;
    color: string;
  }>;
  mappings: StatusMappingItem[];
}

export interface SaveStatusMappingDto {
  bidirectionalSync: boolean;
  mappings: Array<{
    internalStatusId: string;
    externalStatusId: string;
  }>;
}

export interface CrmInboundWebhookDto {
  externalId: string;
  externalStatusId: string;
  updatedAt: string;
}

export type LeadSyncStatus = 'not_required' | 'pending' | 'synced' | 'failed';

export interface FieldMappingItem {
  internalField: string;
  externalField: string;
}

export interface CrmSyncErrorDto {
  id: string;
  leadId: string | null;
  leadName: string | null;
  leadPhone: string | null;
  integrationType: IntegrationType | null;
  errorMessage: string | null;
  retryCount: number;
  updatedAt: string;
}

export interface IntegrationDto {
  id: string;
  tenantId: string;
  type: IntegrationType;
  status: IntegrationStatus;
  config:
    | MetrikaIntegrationConfig
    | GtmIntegrationConfig
    | Ga4IntegrationConfig
    | CrmIntegrationConfig;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationsOverviewDto {
  metrika: IntegrationDto | null;
  gtm: IntegrationDto | null;
  ga4: IntegrationDto | null;
  amocrm: IntegrationDto | null;
  bitrix24: IntegrationDto | null;
}

export interface UpsertMetrikaIntegrationDto {
  counterId: string;
  oauthToken?: string;
  status?: IntegrationStatus;
  events?: ConversionEventsConfig;
  dealWonStatusNames?: string[];
  eventMapping?: Record<string, string>;
}

export interface UpsertGtmIntegrationDto {
  containerId: string;
  status?: IntegrationStatus;
}

export interface UpsertGa4IntegrationDto {
  measurementId: string;
  apiSecret: string;
  status?: IntegrationStatus;
  events?: ConversionEventsConfig;
  dealWonStatusNames?: string[];
  eventMapping?: Record<string, string>;
}

export interface SaveFieldMappingDto {
  mappings: FieldMappingItem[];
}
