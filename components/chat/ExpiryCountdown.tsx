'use client';

import { useEffect, useState } from 'react';
import { Hourglass } from 'lucide-react';

const HOUR = 3600000;
const DAY = 24 * HOUR;

export function formatExpiry(expiresAt: string | Date, now = Date.now()): { label: string; urgent: boolean; expired: boolean } {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return { label: 'Expired', urgent: true, expired: true };
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.max(1, Math.floor((ms % HOUR) / 60000));
  const label = d > 0 ? `Expires in ${d}d ${h}h` : h > 0 ? `Expires in ${h}h ${m}m` : `Expires in ${m}m`;
  return { label, urgent: ms < DAY, expired: false };
}

/** Re-renders once a minute so the countdown stays fresh. */
function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

interface Props {
  expiresAt: string | Date;
  /** Show the "Say hi before it expires" nudge. */
  nudge?: boolean;
  className?: string;
}

export default function ExpiryCountdown({ expiresAt, nudge = false, className = '' }: Props) {
  const now = useNow();
  const { label, urgent, expired } = formatExpiry(expiresAt, now);
  return (
    <span className={`inline-flex flex-col ${className}`}>
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${urgent ? 'text-red-400' : 'text-[#D4AF37]'}`}>
        <Hourglass size={11} className={urgent && !expired ? 'animate-pulse' : ''} />
        {expired ? 'Match expired' : label}
      </span>
      {nudge && !expired && (
        <span className="text-[11px] text-white/40">Say hi before it expires</span>
      )}
    </span>
  );
}
