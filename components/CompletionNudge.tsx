'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useSession } from 'next-auth/react';

function getDismissKey() {
  const today = new Date().toISOString().slice(0, 10);
  return `velour_nudge_dismissed_${today}`;
}

export default function CompletionNudge() {
  const { status } = useSession();
  const [completeness, setCompleteness] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(true); // start dismissed until loaded

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (typeof window !== 'undefined' && localStorage.getItem(getDismissKey())) return;

    async function fetchProfile() {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          const pct: number = data.profileCompleteness ?? data.completeness ?? 100;
          if (pct < 80) {
            setCompleteness(pct);
            setDismissed(false);
          }
        }
      } catch { /* ignore */ }
    }

    fetchProfile();
  }, [status]);

  function handleDismiss() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(getDismissKey(), '1');
    }
    setDismissed(true);
  }

  if (dismissed || completeness === null) return null;

  return (
    <div className="glass border border-[#D4AF37]/30 rounded-xl p-4 mb-6 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-white/40 hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>

      <div className="pr-6">
        <p className="text-white text-sm font-medium mb-1">
          Your profile is{' '}
          <span className="text-[#D4AF37] font-bold">{completeness}% complete</span>
          {' '}— members with complete profiles get{' '}
          <span className="text-white font-semibold">5× more matches</span>
        </p>

        <div className="mt-3 mb-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#DC143C] transition-all duration-500"
            style={{ width: `${completeness}%` }}
          />
        </div>

        <Link
          href="/profile"
          className="inline-block text-xs font-semibold text-[#D4AF37] hover:text-white border border-[#D4AF37]/50 hover:border-[#D4AF37] px-4 py-1.5 rounded-lg transition-all"
        >
          Complete Profile
        </Link>
      </div>
    </div>
  );
}
