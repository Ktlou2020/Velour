'use client';

import { useEffect } from 'react';

/**
 * Counts a top-of-funnel step (lib/funnel.ts) once per browser per day for
 * the admin sign-up funnel. Anonymous: no cookies or identifiers are sent.
 */
export default function FunnelBeacon({ step }: { step: 'visit' | 'signup_page' }) {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.webdriver) return;
    const key = `ub_funnel:${step}:${new Date().toISOString().slice(0, 10)}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch { /* storage blocked: still count */ }
    fetch('/api/funnel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step }),
      keepalive: true,
    }).catch(() => {});
  }, [step]);
  return null;
}
