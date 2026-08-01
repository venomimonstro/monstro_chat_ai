import { useCallback, useEffect, useRef, useState } from 'react';

const SCROLL_THRESHOLD = 80;

export function useChatScroll(deps: unknown[]) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const userScrolledUpRef = useRef(false);

  const scrollToBottom = useCallback((smooth = true) => {
    endRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'end',
    });
    userScrolledUpRef.current = false;
    setShowScrollDown(false);
  }, []);

  const handleScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
    userScrolledUpRef.current = !atBottom;
    setShowScrollDown(!atBottom);
  }, []);

  useEffect(() => {
    if (!userScrolledUpRef.current) {
      scrollToBottom(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    bodyRef,
    endRef,
    showScrollDown,
    scrollToBottom,
    handleScroll,
  };
}
