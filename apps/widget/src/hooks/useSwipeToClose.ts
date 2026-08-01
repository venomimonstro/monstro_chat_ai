import { useCallback, useRef } from 'react';

const SWIPE_THRESHOLD = 80;

export function useSwipeToClose(onClose: () => void, enabled: boolean) {
  const startYRef = useRef<number | null>(null);
  const currentYRef = useRef(0);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      startYRef.current = e.touches[0]?.clientY ?? null;
      currentYRef.current = 0;
    },
    [enabled],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || startYRef.current === null) return;
      const delta = (e.touches[0]?.clientY ?? 0) - startYRef.current;
      if (delta > 0) currentYRef.current = delta;
    },
    [enabled],
  );

  const onTouchEnd = useCallback(() => {
    if (!enabled) return;
    if (currentYRef.current >= SWIPE_THRESHOLD) {
      onClose();
    }
    startYRef.current = null;
    currentYRef.current = 0;
  }, [enabled, onClose]);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
