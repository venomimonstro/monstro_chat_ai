export interface TelegramChannelCredentials {
  botTokenEncrypted?: string;
  botUsername?: string;
}

export interface VkChannelCredentials {
  groupId?: number;
  accessTokenEncrypted?: string;
  confirmationCode?: string;
}

export interface SourceChannelConfig {
  telegram?: TelegramChannelCredentials;
  vk?: VkChannelCredentials;
}

export interface ConnectTelegramChannelDto {
  botToken: string;
}

export interface ConnectVkChannelDto {
  groupId: number;
  accessToken: string;
  confirmationCode: string;
}

export interface ChannelConnectResult {
  success: boolean;
  webhookUrl?: string;
  botUsername?: string;
}
