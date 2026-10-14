'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'hush_show_explicit_reviews';

/** Per-viewer "Always show explicit reviews" preference (this browser only). */
export function useExplicitPref(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try { setOn(localStorage.getItem(KEY) === '1'); } catch { /* storage unavailable */ }
  }, []);
  const set = useCallback((v: boolean) => {
    setOn(v);
    try { if (v) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* ignore */ }
  }, []);
  return [on, set];
}
