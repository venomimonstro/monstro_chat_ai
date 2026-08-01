export type WidgetPosition = 'bottom-right' | 'bottom-left';
export type WidgetButtonShape = 'round' | 'square';
export type WidgetTheme = 'light' | 'dark';
export type SourceType = 'website' | 'vk' | 'telegram';
export type SourceStatus = 'active' | 'inactive';

export interface WidgetAppearanceConfig {
  primaryColor: string;
  textColor: string;
  buttonShape: WidgetButtonShape;
  theme: WidgetTheme;
  avatarUrl?: string;
  position: WidgetPosition;
  offsetX: number;
  offsetY: number;
  hideOnMobile: boolean;
}

export interface WidgetSecurityConfig {
  allowedOrigins?: string[];
}

export interface WidgetPersonalizationConfig {
  companyName: string;
  managerName: string;
  managerPhotoUrl?: string;
  welcomeMessage: string;
  inputPlaceholder: string;
}

export interface WidgetBehaviorConfig {
  autoOpenDelaySeconds?: number;
  autoOpenOnScrollPercent?: number;
  exitIntent: boolean;
  quickReplies?: string[];
  /** When true (default), embed makes no API/iframe requests until user clicks launcher */
  lazyLoad?: boolean;
}

export interface SourceLeadConfig {
  enabled?: boolean;
  requiredFields?: Array<'phone' | 'email' | 'name'>;
}

export interface SourceAiConfig {
  clientPrompt?: string;
  leadExtraction?: SourceLeadConfig;
}

export interface SourceConfig {
  appearance: WidgetAppearanceConfig;
  personalization: WidgetPersonalizationConfig;
  behavior: WidgetBehaviorConfig;
  security?: WidgetSecurityConfig;
  ai?: SourceAiConfig;
  channel?: import('./channels').SourceChannelConfig;
}

export const DEFAULT_SOURCE_CONFIG: SourceConfig = {
  appearance: {
    primaryColor: '#2563eb',
    textColor: '#ffffff',
    buttonShape: 'round',
    theme: 'light',
    position: 'bottom-right',
    offsetX: 20,
    offsetY: 20,
    hideOnMobile: false,
  },
  personalization: {
    companyName: 'Поддержка',
    managerName: 'Анна',
    welcomeMessage: 'Здравствуйте! Чем могу помочь?',
    inputPlaceholder: 'Напишите сообщение...',
  },
  behavior: {
    exitIntent: false,
    lazyLoad: true,
    quickReplies: ['Какие тарифы?', 'Как подключить?', 'Оставить заявку'],
  },
  security: {
    allowedOrigins: [],
  },
};

export interface SourceDto {
  id: string;
  tenantId: string;
  type: SourceType;
  name: string;
  widgetKey: string;
  status: SourceStatus;
  config: SourceConfig;
  scriptInstalledAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WidgetPublicConfig {
  widgetKey: string;
  status: SourceStatus;
  config: SourceConfig;
  configVersion: number;
}

export interface WidgetPingRequest {
  widgetKey: string;
  pageUrl?: string;
}
