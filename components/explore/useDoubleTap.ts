'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Single tap → `onSingle` (after a short wait), double tap → `onDouble`.
 * Keyboard activation (click with detail 0) fires `onSingle` straight away.
 */
export function useDoubleTap(onSingle: () => void, onDouble: () => void, delay = 260) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(0);
  const single = useRef(onSingle);
  const dbl = useRef(onDouble);
  single.current = onSingle;
  dbl.current = onDouble;

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return useCallback((e: React.MouseEvent) => {
    if (e.detail === 0) { single.current(); return; }
    const now = Date.now();
    if (now - last.current < delay) {
      last.current = 0;
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      dbl.current();
      return;
    }
    last.current = now;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; single.current(); }, delay);
  }, [delay]);
}
