'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, X } from 'lucide-react';
import { enablePush, getLocal, pushState, setLocal } from '@/lib/pwa-client';

const KEY = 'unbound_reply_nudge_dismissed_at';
const SNOOZE_DAYS = 14;

/**
 * After a member sends a message: "Get an alert when {name} replies". Shown
 * only when alerts are off on this device (iPhone in Safari: points to adding
 * the home-screen app first). "Not now" hides it for 14 days.
 */
export default function ReplyAlertNudge({ name, sentCount }: { name: string; sentCount: number }) {
  const [mode, setMode] = useState<'off' | 'needs-install' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sentCount < 1) return;
    const at = Number(getLocal(KEY) || 0);
    if (at && Date.now() - at < SNOOZE_DAYS * 86400000) return;
    let cancelled = false;
    pushState().then((s) => { if (!cancelled) setMode(s === 'off' || s === 'needs-install' ? s : null); });
    return () => { cancelled = true; };
  }, [sentCount]);

  if (!mode) return null;
  const dismiss = () => { setLocal(KEY, String(Date.now())); setMode(null); };

  async function turnOn() {
    setBusy(true);
    try {
      const r = await enablePush();
      if (r === 'denied') dismiss(); else if (r === 'on') setMode(null);
    } finally { setBusy(false); }
  }

  return (
    <div className="mb-2 rounded-xl border border-[#DC143C]/25 bg-[#DC143C]/[0.08] px-3 py-2 text-xs text-white/80 flex items-center gap-2" role="status" data-testid="reply-alert-nudge">
      <Bell size={14} className="text-[#FF4D6D] flex-shrink-0" aria-hidden="true" />
      <p className="flex-1 min-w-0 leading-snug">
        {mode === 'off'
          ? <>Get an alert when <span className="text-white font-medium">{name}</span> replies.</>
          : <>Add Unbound to your home screen to get an alert when <span className="text-white font-medium">{name}</span> replies.</>}
      </p>
      {mode === 'off' ? (
        <button type="button" onClick={turnOn} disabled={busy} className="bg-[#DC143C] hover:bg-[#FF1744] text-white font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 disabled:opacity-60">Turn on</button>
      ) : (
        <Link href="/account#app" className="bg-[#DC143C] hover:bg-[#FF1744] text-white font-semibold px-3 py-1.5 rounded-lg flex-shrink-0">Show me</Link>
      )}
      <button type="button" onClick={dismiss} className="text-white/60 hover:text-white flex-shrink-0" aria-label="Not now"><X size={13} /></button>
    </div>
  );
}
