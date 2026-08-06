/** Слияние стабильных сообщений с live-stream bubble (без пересборки всего массива). */
export interface ChatMessageLike {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  createdAt?: string;
}

export function mergeLiveStream<T extends ChatMessageLike>(
  messages: T[],
  liveContent: string | null,
): T[] {
  if (liveContent === null) return messages;
  const last = messages[messages.length - 1];
  if (last?.streaming) {
    const copy = messages.slice(0, -1);
    return [
      ...copy,
      { ...last, content: liveContent, streaming: true } as T,
    ];
  }
  return [
    ...messages,
    {
      role: 'assistant',
      content: liveContent,
      streaming: true,
    } as T,
  ];
}

/** Симуляция RAF-батчинга токенов (для тестов и браузера). */
export function createStreamBatcher(
  onFlush: (content: string) => void,
): {
  push: (token: string) => void;
  flush: () => void;
  cancel: () => void;
} {
  let buffer = '';
  let rafId: ReturnType<typeof setTimeout> | number | null = null;

  const scheduleFrame =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16);

  const cancelFrame =
    typeof cancelAnimationFrame === 'function'
      ? cancelAnimationFrame
      : (id: ReturnType<typeof setTimeout> | number) => clearTimeout(id as ReturnType<typeof setTimeout>);

  const schedule = () => {
    if (rafId !== null) return;
    rafId = scheduleFrame(() => {
      rafId = null;
      const chunk = buffer;
      buffer = '';
      if (chunk) onFlush(chunk);
    });
  };

  return {
    push(token: string) {
      buffer += token;
      schedule();
    },
    flush() {
      if (rafId !== null) {
        cancelFrame(rafId);
        rafId = null;
      }
      const chunk = buffer;
      buffer = '';
      if (chunk) onFlush(chunk);
    },
    cancel() {
      if (rafId !== null) {
        cancelFrame(rafId);
        rafId = null;
      }
      buffer = '';
    },
  };
}
