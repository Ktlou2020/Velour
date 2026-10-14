'use client';

import { useState } from 'react';
import type { Badge } from '@/lib/badges';

interface Props {
  badges: Badge[];
  /** How many to show before collapsing into "+N". */
  max?: number;
  className?: string;
}

/** Compact row of earned badges for a member profile: up to `max`, then "+N". */
export default function BadgeRow({ badges, max = 5, className = '' }: Props) {
  const [expanded, setExpanded] = useState(false);
  const earned = badges.filter((b) => b.earned);
  if (!earned.length) return null;
  const shown = expanded ? earned : earned.slice(0, max);
  const hidden = earned.length - shown.length;
  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${className}`} aria-label="Badges">
      {shown.map((b) => (
        <li
          key={b.id}
          title={`${b.label} — ${b.description}`}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/80"
        >
          <span aria-hidden="true">{b.emoji}</span>
          <span>{b.label}</span>
        </li>
      ))}
      {hidden > 0 && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/60 hover:text-white"
            aria-label={`Show ${hidden} more badges`}
          >
            +{hidden}
          </button>
        </li>
      )}
    </ul>
  );
}
