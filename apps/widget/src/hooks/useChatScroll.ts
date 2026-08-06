import { useCallback, useEffect, useRef, useState } from 'react';

const SCROLL_THRESHOLD = 96;
const SCROLL_THROTTLE_MS = 80;

interface UseChatScrollOptions {
  open: boolean;
  messageCount: number;
  streaming: boolean;
  /** Длина live-stream контента — триггер скролла без роста messageCount */
  streamContentLength?: number;
}

export function useChatScroll({
  open,
  messageCount,
  streaming,
  streamContentLength = 0,
}: UseChatScrollOptions) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);
  const prevMessageCountRef = useRef(messageCount);
  const scrollRafRef = useRef<number | null>(null);
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showScrollDownRef = useRef(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const isNearBottom = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
    pinnedRef.current = true;
    showScrollDownRef.current = false;
    setShowScrollDown(false);
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollThrottleRef.current !== null) return;
    scrollThrottleRef.current = setTimeout(() => {
      scrollThrottleRef.current = null;
      const near = isNearBottom();
      pinnedRef.current = near;
      const show = !near;
      if (showScrollDownRef.current !== show) {
        showScrollDownRef.current = show;
        setShowScrollDown(show);
      }
    }, SCROLL_THROTTLE_MS);
  }, [isNearBottom]);

  useEffect(() => {
    if (!open) return;
    pinnedRef.current = true;
    requestAnimationFrame(() => scrollToBottom(false));
  }, [open, scrollToBottom]);

  useEffect(() => {
    if (messageCount > prevMessageCountRef.current) {
      pinnedRef.current = true;
      requestAnimationFrame(() => scrollToBottom(false));
    }
    prevMessageCountRef.current = messageCount;
  }, [messageCount, scrollToBottom]);

  useEffect(() => {
    if (!streaming || streamContentLength === 0) return;
    if (!pinnedRef.current) return;
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = bodyRef.current;
      if (!el || !pinnedRef.current) return;
      el.scrollTop = el.scrollHeight;
    });
  }, [streaming, streamContentLength]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || !open) return;

    const scrollIfPinned = () => {
      if (!pinnedRef.current) return;
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        const el = bodyRef.current;
        if (!el || !pinnedRef.current) return;
        el.scrollTop = el.scrollHeight;
      });
    };

    const observer = new ResizeObserver(scrollIfPinned);
    observer.observe(content);

    return () => {
      observer.disconnect();
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
      if (scrollThrottleRef.current !== null) {
        clearTimeout(scrollThrottleRef.current);
      }
    };
  }, []);

  return {
    bodyRef,
    contentRef,
    endRef,
    showScrollDown,
    scrollToBottom,
    handleScroll,
  };
}
