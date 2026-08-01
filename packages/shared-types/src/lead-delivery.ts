export type LeadDeliveryChannelType =
  | 'telegram'
  | 'email'
  | 'google_sheets'
  | 'amocrm'
  | 'bitrix24';

export type LeadDeliveryLogStatus = 'pending' | 'success' | 'failed' | 'retrying';

export interface TelegramDeliveryConfig {
  chatId?: string;
  botUsername?: string;
  hasToken?: boolean;
}

export interface EmailDeliveryConfig {
  recipients: string[];
}

export interface GoogleSheetsDeliveryConfig {
  spreadsheetId?: string;
  sheetName?: string;
  connected?: boolean;
}

export interface CrmDeliveryConfig {
  instantDelivery?: boolean;
}

export type LeadDeliveryConfig =
  | TelegramDeliveryConfig
  | EmailDeliveryConfig
  | GoogleSheetsDeliveryConfig
  | CrmDeliveryConfig;

export interface LeadDeliveryChannelDto {
  id: string;
  tenantId: string;
  type: LeadDeliveryChannelType;
  name: string;
  enabled: boolean;
  config: LeadDeliveryConfig;
  createdAt: string;
  updatedAt: string;
}

export interface LeadDeliveryLogDto {
  id: string;
  channelId: string;
  channelName: string;
  channelType: LeadDeliveryChannelType;
  leadId: string | null;
  status: LeadDeliveryLogStatus;
  errorMessage: string | null;
  createdAt: string;
}

export interface CreateLeadDeliveryChannelDto {
  type: LeadDeliveryChannelType;
  name: string;
  enabled?: boolean;
  config?: LeadDeliveryConfig;
  botToken?: string;
}

export interface UpdateLeadDeliveryChannelDto {
  name?: string;
  enabled?: boolean;
  config?: LeadDeliveryConfig;
  botToken?: string;
}

export interface ValidateTelegramDto {
  botToken: string;
  chatId?: string;
}

export interface ValidateTelegramResponse {
  ok: boolean;
  botUsername?: string;
  error?: string;
}
