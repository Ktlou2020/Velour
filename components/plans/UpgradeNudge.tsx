'use client';

import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Crown, X } from 'lucide-react';

/*
 * A calm, dismissible upgrade suggestion for a locked feature.
 *  - Never a modal: it sits in the page flow.
 *  - At most one nudge is visible per page view. The first one mounted wins;
 *    a nudge the member opened themselves (`takeover`, e.g. tapping a locked
 *    control) replaces it.
 *  - Dismissing hides that feature's nudge for the rest of the browser session.
 */

let activeId: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const store = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  get: () => activeId,
  claim(id: string, force: boolean) { if (activeId === null || force) { activeId = id; emit(); } },
  release(id: string) { if (activeId === id) { activeId = null; emit(); } },
};

const DISMISS_KEY = 'hush_nudge_dismissed:';
function wasDismissed(feature: string): boolean {
  try { return sessionStorage.getItem(DISMISS_KEY + feature) === '1'; } catch { return false; }
}
function rememberDismissed(feature: string) {
  try { sessionStorage.setItem(DISMISS_KEY + feature, '1'); } catch { /* storage unavailable */ }
}

export interface UpgradeNudgeProps {
  /** Stable key for the feature, e.g. "advanced-filters". */
  feature: string;
  title: string;
  body: string;
  tier?: 'GOLD' | 'PLATINUM';
  ctaLabel?: string;
  /** Opened by the member (tapping a lock) — takes the page's single nudge slot. */
  takeover?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export default function UpgradeNudge({ feature, title, body, tier = 'GOLD', ctaLabel, takeover = false, onDismiss, className = '' }: UpgradeNudgeProps) {
  const id = useId();
  const active = useSyncExternalStore(store.subscribe, store.get, () => null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!takeover && wasDismissed(feature)) { setHidden(true); return; }
    setHidden(false);
    store.claim(id, takeover);
    return () => store.release(id);
  }, [id, feature, takeover]);

  if (hidden || active !== id) return null;

  const gold = tier === 'GOLD';
  function dismiss() {
    rememberDismissed(feature);
    setHidden(true);
    store.release(id);
    onDismiss?.();
  }

  return (
    <aside
      role="note"
      aria-label={`${gold ? 'Gold' : 'Platinum'} feature: ${title}`}
      className={`relative glass rounded-2xl p-4 pr-10 border ${gold ? 'border-[#D4AF37]/25' : 'border-purple-400/25'} flex items-start gap-3 ${className}`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${gold ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : 'bg-purple-500/10 text-purple-300'}`}>
        <Crown size={16} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-white text-sm font-semibold">{title}</p>
        <p className="text-white/65 text-xs sm:text-sm leading-relaxed mt-0.5">{body}</p>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <Link
            href="/upgrade#compare"
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg transition-colors ${
              gold ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] hover:from-[#F4D03F] hover:to-[#D4AF37]' : 'bg-gradient-to-r from-purple-600 to-purple-800 text-white hover:from-purple-500 hover:to-purple-700'
            }`}
          >
            {ctaLabel ?? `See ${gold ? 'Gold' : 'Platinum'}`}
          </Link>
          <button onClick={dismiss} className="text-white/55 hover:text-white/80 text-xs">Not now</button>
        </div>
      </div>
      <button onClick={dismiss} aria-label="Dismiss" className="absolute top-3 right-3 text-white/40 hover:text-white/80 p-1">
        <X size={14} />
      </button>
    </aside>
  );
}
