'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';

const KEY = 'hush_protection_note_dismissed';

/**
 * One-time, dismissible explanation of how members' photos are protected.
 * Honest by design: saving is blocked and every copy is watermarked with the
 * viewer's username, but no website can fully stop screenshots.
 */
export default function ProtectionNote({ className = '' }: { className?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try { setShow(localStorage.getItem(KEY) !== '1'); } catch { setShow(true); }
  }, []);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(KEY, '1'); } catch { /* private mode */ }
  }

  return (
    <div role="note" className={`relative flex items-start gap-3 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.06] px-4 py-3 pr-11 ${className}`}>
      <ShieldCheck size={18} className="text-[#D4AF37] shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-sm text-white/80 leading-relaxed">
        Your photos are watermarked with each viewer’s username, and saving is blocked. No website can fully stop screenshots, but every copy traces back to who took it.{' '}
        <a href="/safety#content-protection" className="text-[#D4AF37] hover:underline whitespace-nowrap">How it works</a>
      </p>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="absolute top-2 right-2 p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10">
        <X size={15} />
      </button>
    </div>
  );
}
