import { useCallback, useEffect, useRef, useState } from 'react';

const SCROLL_THRESHOLD = 96;

interface UseChatScrollOptions {
  open: boolean;
  messageCount: number;
  streaming: boolean;
}

export function useChatScroll({
  open,
  messageCount,
  streaming,
}: UseChatScrollOptions) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);
  const prevMessageCountRef = useRef(messageCount);
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
    setShowScrollDown(false);
  }, []);

  const handleScroll = useCallback(() => {
    const near = isNearBottom();
    pinnedRef.current = near;
    setShowScrollDown(!near);
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
    const content = contentRef.current;
    if (!content || !open) return;

    const scrollIfPinned = () => {
      if (!pinnedRef.current) return;
      const el = bodyRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    };

    const observer = new ResizeObserver(() => {
      scrollIfPinned();
    });
    observer.observe(content);
    scrollIfPinned();

    return () => observer.disconnect();
  }, [open, messageCount, streaming]);

  return {
    bodyRef,
    contentRef,
    endRef,
    showScrollDown,
    scrollToBottom,
    handleScroll,
  };
}
