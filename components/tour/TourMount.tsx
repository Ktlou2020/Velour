'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { TOUR_AUTO_PATHS, TOUR_START_EVENT, tourDoneKey } from './events';

// The tour UI is only downloaded when it's actually opened, so this mount
// costs logged-out visitors (and returning members) next to nothing.
const Tour = dynamic(() => import('./Tour'), { ssr: false });

function readDone(userId: string): boolean {
  try { return localStorage.getItem(tourDoneKey(userId)) === '1'; } catch { return false; }
}
function writeDone(userId: string) {
  try { localStorage.setItem(tourDoneKey(userId), '1'); } catch { /* private mode etc. */ }
}

// One server check per user per page load, however many times they navigate.
const checked = new Set<string>();

export default function TourMount() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const userId = status === 'authenticated' ? session?.user?.id : undefined;
  const [open, setOpen] = useState(false);

  // Manual replay ("Take the tour" in the account menu).
  useEffect(() => {
    if (!userId) return;
    const onStart = () => setOpen(true);
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [userId]);

  // Auto-show once for brand-new members on the landing pages.
  useEffect(() => {
    if (!userId || open) return;
    if (!TOUR_AUTO_PATHS.includes(pathname)) return;
    if (readDone(userId) || checked.has(userId)) return;
    checked.add(userId);

    let cancelled = false;
    let settled = false;
    let timer = 0;
    fetch('/api/tour', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { completed?: boolean; autoShow?: boolean } | null) => {
        if (cancelled || !d) return;
        if (d.completed) { settled = true; writeDone(userId); return; }
        if (!d.autoShow) { settled = true; return; }
        // Give the page a moment to paint its nav bars before spotlighting them.
        timer = window.setTimeout(() => { settled = true; setOpen(true); }, 800);
      })
      .catch(() => { checked.delete(userId); });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      // Navigated away before we got to open it: try again on the next visit.
      if (!settled) checked.delete(userId);
    };
  }, [userId, pathname, open]);

  // Leaving for a focused flow closes the tour.
  useEffect(() => {
    if (/^\/(onboarding|auth|admin)(\/|$)/.test(pathname)) setOpen(false);
  }, [pathname]);

  const handleClose = useCallback(() => {
    setOpen(false);
    if (!userId) return;
    // Finished or skipped: either way, don't auto-show again (on any device).
    writeDone(userId);
    fetch('/api/tour', { method: 'POST', keepalive: true }).catch(() => {});
  }, [userId]);

  if (!userId || !open) return null;
  return <Tour onClose={handleClose} />;
}
