export type UserRole = 'owner' | 'admin' | 'client' | 'manager';

export type TenantStatus = 'active' | 'suspended' | 'trial_expired';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'paused';

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  version: string;
}

export interface HealthDbResponse extends HealthCheckResponse {
  database: 'connected' | 'disconnected';
}

export interface HealthRedisResponse extends HealthCheckResponse {
  redis: 'connected' | 'disconnected';
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

export interface TenantDto {
  id: string;
  name: string;
  status: TenantStatus;
  trialEndsAt: string | null;
  createdAt: string;
}

export interface UserDto {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string | null;
  status: string;
}


export * from './auth';
export * from './billing';
export * from './analytics';
export * from './analytics-reports';
export * from './integrations';
export * from './lead-delivery';
export * from './admin';
export * from './updates';

export * from './outgoing-webhook';
export * from './notifications';
export * from './team';
export * from './channels';
export * from './prompt-experiment';
export * from './push';
export {
  DEFAULT_SOURCE_CONFIG,
  mergeSourceConfig,
  patchSourceConfig,
} from './source';
export type {
  WidgetPosition,
  WidgetButtonShape,
  WidgetTheme,
  SourceType,
  SourceStatus,
  WidgetAppearanceConfig,
  WidgetSecurityConfig,
  WidgetPersonalizationConfig,
  WidgetBehaviorConfig,
  SourceConfig,
  SourceDto,
  WidgetPublicConfig,
  WidgetPingRequest,
  SourceAiConfig,
  SourceLeadConfig,
  LeadProfileMode,
} from './source';
export type {
  PromptDto,
  PlaygroundTestRequest,
  PlaygroundTestResponse,
} from './prompt';
export type {
  PipelineDto,
  PipelineStatusDto,
  LeadDto,
  LeadStatusHistoryDto,
  TenantUserDto,
  DuplicateLeadSuggestion,
} from './crm';
