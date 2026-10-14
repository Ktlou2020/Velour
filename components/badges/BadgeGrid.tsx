import Link from 'next/link';
import { Award } from 'lucide-react';
import type { Badge } from '@/lib/badges';

/** "Your badges" — every badge, earned or with progress towards it. */
export default function BadgeGrid({ badges, className = '' }: { badges: Badge[]; className?: string }) {
  const earnedCount = badges.filter((b) => b.earned).length;
  return (
    <section id="badges" className={`glass rounded-2xl p-6 scroll-mt-24 ${className}`} aria-labelledby="badges-heading">
      <div className="flex items-center justify-between mb-4">
        <h2 id="badges-heading" className="text-white font-semibold flex items-center gap-2">
          <Award size={16} className="text-[#D4AF37]" />
          Your badges
        </h2>
        <span className="text-white/55 text-xs">{earnedCount} of {badges.length} earned</span>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {badges.map((b) => {
          const pct = b.progress ? Math.round((b.progress.current / b.progress.target) * 100) : 0;
          const body = (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                <span
                  aria-hidden="true"
                  className={`w-9 h-9 sm:w-10 sm:h-10 text-lg sm:text-xl rounded-xl flex items-center justify-center flex-shrink-0 ${b.earned ? 'bg-gradient-to-br from-[#D4AF37]/25 to-[#DC143C]/15 border border-[#D4AF37]/30' : 'bg-white/[0.04] border border-white/10 grayscale opacity-60'}`}
                >
                  {b.emoji}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${b.earned ? 'text-white' : 'text-white/75'}`}>{b.label}</p>
                  <p className="text-white/55 text-xs leading-snug mt-0.5">{b.description}</p>
                </div>
              </div>
              {b.earned ? (
                <p className="text-[#D4AF37] text-[11px] font-semibold mt-3">Earned</p>
              ) : b.progress ? (
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-white/50 mb-1">
                    <span>{b.progress.target === 100 ? `${b.progress.current}%` : `${b.progress.current} / ${b.progress.target}`}</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#DC143C] to-[#D4AF37]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ) : (
                <p className="text-white/40 text-[11px] mt-3">Not yet</p>
              )}
            </>
          );
          const cls = `block h-full rounded-xl p-3.5 border transition-colors ${b.earned ? 'border-[#D4AF37]/20 bg-[#D4AF37]/[0.04]' : 'border-white/5 bg-white/[0.02]'}`;
          return (
            <li key={b.id}>
              {!b.earned && b.href ? (
                <Link href={b.href} className={`${cls} hover:border-white/15`}>{body}</Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
