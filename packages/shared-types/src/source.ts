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
  rateLimitPerMinute?: number;
  ipRateLimitPerMinute?: number;
}

export interface WidgetPersonalizationConfig {
  companyName: string;
  managerName: string;
  managerPhotoUrl?: string;
  welcomeMessage: string;
  inputPlaceholder: string;
}

export interface WidgetBehaviorConfig {
  /** Auto-open chat after N seconds on page (0 = disabled). */
  autoOpenDelaySeconds?: number;
  /** Auto-open when visitor scrolled at least N% of page (0 = disabled). */
  autoOpenOnScrollPercent?: number;
  /** Open when mouse leaves viewport top (desktop exit intent). */
  exitIntent: boolean;
  quickReplies?: string[];
  /** When true (default), embed makes no API/iframe requests until user clicks launcher */
  lazyLoad?: boolean;
}

export type LeadProfileMode =
  | 'phone'
  | 'phone_name'
  | 'phone_name_surname'
  | 'phone_name_surname_email';

export interface SourceLeadConfig {
  enabled?: boolean;
  requiredFields?: Array<'phone' | 'email' | 'name'>;
  profileMode?: LeadProfileMode;
  /**
   * Min user turns before asking for contact (default 2).
   * Intent keywords (цена, тариф…) can ask earlier.
   */
  askAfterTurns?: number;
  /**
   * Create lead as soon as phone is known; enrich name/email later (default true).
   */
  allowPartial?: boolean;
  /** Auto-link dialog to existing lead with same phone (default true). */
  dedupeByPhone?: boolean;
  /** Auto-link returning visitor to their recent lead (default true). */
  dedupeByVisitor?: boolean;
}

export interface SourceAiConfig {
  clientPrompt?: string;
  leadExtraction?: SourceLeadConfig;
  /** Автономный дожим лидов — follow-up без оператора (Sprint 66). */
  closer?: import('./closer').SourceCloserConfig;
  /** Стиль общения и обработка возражений (Sprint 56). */
  personaStyle?: import('./persona').PersonaStyle;
  objectionHandling?: import('./persona').ObjectionHandling;
  forbiddenPhrases?: string[];
}

export interface SourceConfig {
  appearance: WidgetAppearanceConfig;
  personalization: WidgetPersonalizationConfig;
  behavior: WidgetBehaviorConfig;
  security?: WidgetSecurityConfig;
  ai?: SourceAiConfig;
  channel?: import('./channels').SourceChannelConfig;
  /** Настройки обучения / индексации сайта (Sprint 68). */
  training?: import('./crawl').SourceTrainingConfig;
}

/** Merge stored/partial config with platform defaults (e.g. red primary when DB has legacy blue). */
export function mergeSourceConfig(
  stored: Partial<SourceConfig> | null | undefined,
): SourceConfig {
  const base = DEFAULT_SOURCE_CONFIG;
  const existing = stored ?? {};
  return {
    appearance: { ...base.appearance, ...existing.appearance },
    personalization: { ...base.personalization, ...existing.personalization },
    behavior: { ...base.behavior, ...existing.behavior },
    security: { ...base.security, ...(existing.security ?? {}) },
    ...(existing.ai || base.ai
      ? { ai: { ...base.ai, ...existing.ai } }
      : {}),
    ...(existing.channel ? { channel: existing.channel } : {}),
    ...(existing.training
      ? { training: { ...existing.training } }
      : {}),
  };
}

/** Apply a partial patch on top of merged config (used by source update API). */
export function patchSourceConfig(
  existing: Partial<SourceConfig> | null | undefined,
  patch: Partial<SourceConfig>,
): SourceConfig {
  const base = mergeSourceConfig(existing);
  return mergeSourceConfig({
    ...base,
    ...patch,
    appearance: patch.appearance
      ? { ...base.appearance, ...patch.appearance }
      : base.appearance,
    personalization: patch.personalization
      ? { ...base.personalization, ...patch.personalization }
      : base.personalization,
    behavior: patch.behavior
      ? { ...base.behavior, ...patch.behavior }
      : base.behavior,
    security: patch.security
      ? { ...base.security, ...patch.security }
      : base.security,
    ai: patch.ai
      ? {
          ...base.ai,
          ...patch.ai,
          leadExtraction: patch.ai.leadExtraction
            ? { ...base.ai?.leadExtraction, ...patch.ai.leadExtraction }
            : base.ai?.leadExtraction,
          closer: patch.ai.closer
            ? { ...base.ai?.closer, ...patch.ai.closer }
            : base.ai?.closer,
        }
      : base.ai,
    channel: patch.channel ?? base.channel,
    training: patch.training
      ? { ...base.training, ...patch.training }
      : base.training,
  });
}

export const DEFAULT_SOURCE_CONFIG: SourceConfig = {
  appearance: {
    primaryColor: '#EF2B34',
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
    welcomeMessage:
      'Здравствуйте! Я Анна, помогу разобраться с вопросами по нашему сервису. Что вас интересует?',
    inputPlaceholder: 'Напишите сообщение...',
  },
  behavior: {
    exitIntent: false,
    lazyLoad: true,
    quickReplies: [
      'Сколько это стоит?',
      'Как быстро подключить?',
      'Хочу оставить заявку',
    ],
  },
  security: {
    allowedOrigins: [],
  },
  ai: {
    personaStyle: 'friendly_pro',
    objectionHandling: 'balanced',
    closer: {
      enabled: true,
      delaysMinutes: [5, 60, 1440],
      maxAttempts: 3,
      onlyIncompleteLeads: true,
    },
    leadExtraction: {
      enabled: true,
      profileMode: 'phone',
      askAfterTurns: 2,
      allowPartial: true,
      dedupeByPhone: true,
      dedupeByVisitor: true,
    },
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
