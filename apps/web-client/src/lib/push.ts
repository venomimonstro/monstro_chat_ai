import { api } from './api';
import type { PushSubscriptionDto } from '@ai-consultant/shared-types';

export async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await api.get<{ publicKey: string }>('/push/vapid-public-key');
    return res.data.publicKey || null;
  } catch {
    return null;
  }
}

export async function subscribeToPush(subscription: PushSubscriptionDto) {
  await api.post('/push/subscribe', subscription);
}

export async function unsubscribeFromPush(endpoint: string) {
  await api.delete('/push/subscribe', { data: { endpoint } });
}

export async function registerPushNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const publicKey = await fetchVapidPublicKey();
  if (!publicKey) return false;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const sub =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  await subscribeToPush({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
  return true;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}
