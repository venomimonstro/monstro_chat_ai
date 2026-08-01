import { useEffect, useState } from 'react';
import { registerPushNotifications } from '../lib/push';
import { showToast } from './Toast';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    const onInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => window.removeEventListener('beforeinstallprompt', onInstall);
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      try {
        await registerPushNotifications();
      } catch {
        /* push optional */
      }
    }
    setDeferred(null);
  };

  const handleEnablePush = async () => {
    try {
      const ok = await registerPushNotifications();
      showToast(ok ? 'Push-уведомления включены' : 'Не удалось включить push', ok ? 'success' : 'error');
    } catch {
      showToast('Push недоступен в этом браузере', 'error');
    }
  };

  if (dismissed && !deferred) {
    return (
      <button
        type="button"
        onClick={() => void handleEnablePush()}
        className="mb-4 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        Включить push о новых лидах
      </button>
    );
  }

  if (!deferred) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
      <span>Установите приложение для быстрого доступа к CRM</span>
      <div className="flex gap-2">
        <button type="button" onClick={() => void handleInstall()} className="lk-btn-primary py-1.5">
          Установить
        </button>
        <button type="button" onClick={() => setDismissed(true)} className="text-slate-500 hover:underline">
          Позже
        </button>
      </div>
    </div>
  );
}
