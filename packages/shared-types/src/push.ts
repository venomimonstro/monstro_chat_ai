export interface PushSubscriptionDto {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPublicKeyDto {
  publicKey: string;
}
