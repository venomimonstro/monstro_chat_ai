import { useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

const toasts: ToastMessage[] = [];
let listeners: (() => void)[] = [];

function notify() {
  listeners.forEach((l) => l());
}

export function showToast(message: string, type: ToastType = 'info') {
  const toast = { id: crypto.randomUUID(), message, type };
  toasts.push(toast);
  notify();
  setTimeout(() => {
    const index = toasts.findIndex((t) => t.id === toast.id);
    if (index >= 0) {
      toasts.splice(index, 1);
      notify();
    }
  }, 4000);
}

function useToastStore() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((v) => v + 1);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);
  return toasts;
}

const colors: Record<ToastType, string> = {
  success: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-slate-800 text-white',
};

export function ToastContainer() {
  const active = useToastStore();
  if (active.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      {active.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg px-4 py-2 shadow-lg ${colors[toast.type]}`}
          role="status"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
