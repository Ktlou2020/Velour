'use client';

import Link from 'next/link';
import { Heart, Star, Infinity as InfinityIcon } from 'lucide-react';
import type { Allowance } from '@/app/api/likes/limits';

export type { Allowance };

function resetPhrase(iso: string): string {
  const d = new Date(iso);
  const days = (d.getTime() - Date.now()) / 86400_000;
  if (days <= 1) return 'at midnight';
  return `on ${d.toLocaleDateString('en-ZA', { weekday: 'long', timeZone: 'Africa/Johannesburg' })}`;
}

/** Friendly "38 likes left today · Super likes: 1 left" meter. */
export default function AllowanceMeter({ allowance, className = '' }: { allowance: Allowance | null; className?: string }) {
  if (!allowance) return <div className={`h-6 w-48 rounded-full skeleton ${className}`} aria-hidden="true" />;
  const { likes, superLikes } = allowance;
  const pct = likes.limit ? Math.max(0, Math.min(100, ((likes.remaining ?? 0) / likes.limit) * 100)) : 100;
  const low = likes.limit !== null && (likes.remaining ?? 0) <= Math.ceil(likes.limit * 0.2);
  const superPeriod = superLikes.period === 'day' ? 'today' : 'this week';

  return (
    <div className={`flex items-center gap-x-4 gap-y-1.5 flex-wrap text-xs ${className}`} aria-live="polite">
      <div className="flex items-center gap-2 min-w-0">
        <Heart size={12} className="text-[#FF4D6D] fill-[#FF4D6D] flex-shrink-0" aria-hidden="true" />
        {likes.limit === null ? (
          <span className="text-white/75 inline-flex items-center gap-1">
            <InfinityIcon size={12} aria-hidden="true" /> Unlimited likes
          </span>
        ) : (
          <>
            <span className={low ? 'text-[#FFB3C1]' : 'text-white/75'}>
              <span className="font-semibold text-white">{likes.remaining}</span> like{likes.remaining === 1 ? '' : 's'} left today
            </span>
            <span
              className="hidden sm:block w-20 h-1.5 rounded-full bg-white/10 overflow-hidden"
              role="meter"
              aria-label="Likes left today"
              aria-valuemin={0}
              aria-valuemax={likes.limit}
              aria-valuenow={likes.remaining ?? 0}
            >
              <span className="block h-full rounded-full bg-gradient-to-r from-[#DC143C] to-[#FF4D6D]" style={{ width: `${pct}%` }} />
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-white/75" title={`Refreshes ${resetPhrase(superLikes.resetsAt)}`}>
        <Star size={12} className="text-[#D4AF37] fill-[#D4AF37]" aria-hidden="true" />
        <span>
          Super likes: <span className="font-semibold text-white">{superLikes.remaining}</span> left {superPeriod}
          {superLikes.bonus > 0 && <span className="text-[#D4AF37]"> +{superLikes.bonus} bonus</span>}
        </span>
      </div>
      {allowance.tier === 'FREE' && likes.limit !== null && low && (
        <Link href="/upgrade#compare" className="text-[#D4AF37] hover:underline">Unlimited with Gold</Link>
      )}
    </div>
  );
}

export { resetPhrase };
