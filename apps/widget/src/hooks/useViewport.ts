import { useEffect, useState } from 'react';

export type ViewportSize = 'mobile' | 'tablet' | 'desktop';

function getViewportSize(): ViewportSize {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export function useViewport(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(getViewportSize);

  useEffect(() => {
    const onResize = () => setSize(getViewportSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
}

export function useVisualViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => setHeight(vv.height);
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return height;
}

export function useVisualViewport(): { height: number | null; offsetTop: number } {
  const [state, setState] = useState<{ height: number | null; offsetTop: number }>({
    height: null,
    offsetTop: 0,
  });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let rafId: number | null = null;
    const update = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setState({ height: vv.height, offsetTop: vv.offsetTop });
      });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return state;
}
