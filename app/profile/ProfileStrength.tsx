'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Gauge, Sparkles } from 'lucide-react';
import { profileStrength, type StrengthFacts } from './strength';

function tierOf(p: number): string {
  if (p >= 100) return 'Standout profile';
  if (p >= 80) return 'Almost there';
  if (p >= 50) return 'Looking good';
  return 'Off to a good start';
}

/** Profile strength meter with concrete, friendly next steps. */
export default function ProfileStrength({ facts }: { facts: StrengthFacts }) {
  const { percent, steps } = profileStrength(facts);
  const [showAll, setShowAll] = useState(false);
  const done = percent >= 100;
  const visible = showAll ? steps : steps.slice(0, 3);

  return (
    <section
      id="strength"
      aria-labelledby="strength-heading"
      className={`relative overflow-hidden glass rounded-2xl p-6 mb-6 scroll-mt-24 ${done ? 'border border-[#D4AF37]/30' : ''}`}
    >
      {done && (
        <div aria-hidden="true" className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-[#D4AF37]/15 blur-3xl motion-safe:animate-fadeIn" />
      )}
      <div className="relative">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 id="strength-heading" className="text-white font-semibold flex items-center gap-2">
            <Gauge size={16} className="text-[#DC143C]" />
            Profile strength
          </h2>
          <span className={`text-sm font-semibold ${done ? 'text-[#D4AF37]' : 'text-[#FF4D6D]'}`}>
            {percent}% · <span className="font-normal text-white/65">{tierOf(percent)}</span>
          </span>
        </div>
        <div
          className="h-2.5 bg-white/10 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Profile strength"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-700 ease-out ${done
              ? 'bg-gradient-to-r from-[#B8960C] via-[#F4D03F] to-[#B8960C] bg-[length:200%_100%] motion-safe:animate-shimmer'
              : 'bg-gradient-to-r from-[#DC143C] to-[#D4AF37]'}`}
            style={{ width: `${Math.max(percent, 4)}%` }}
          />
        </div>

        {done ? (
          <p className="text-white/75 text-sm mt-4 flex items-center gap-2 motion-safe:animate-fadeIn">
            <Sparkles size={14} className="text-[#D4AF37] flex-shrink-0" />
            Your profile is complete — it shows. Keep it fresh with a new photo or today&apos;s Spark now and then.
          </p>
        ) : (
          <p className="text-white/60 text-xs mt-2">A few small touches help the right people find you.</p>
        )}

        {steps.length > 0 && (
          <ul className="mt-4 divide-y divide-white/5">
            {visible.map((s) => {
              const inner = (
                <>
                  <span className="text-white/85 text-sm">{s.label}</span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    {s.gain > 0 ? (
                      <span className="text-[#D4AF37] text-xs font-semibold">+{s.gain}%</span>
                    ) : (
                      <span className="text-white/45 text-xs">Daily</span>
                    )}
                    <ChevronRight size={14} className="text-white/35 group-hover:text-white/70 transition-colors" />
                  </span>
                </>
              );
              const cls = 'group flex items-center justify-between gap-3 py-2.5 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors';
              return (
                <li key={s.id}>
                  {s.href.startsWith('#') ? <a href={s.href} className={cls}>{inner}</a> : <Link href={s.href} className={cls}>{inner}</Link>}
                </li>
              );
            })}
          </ul>
        )}
        {steps.length > 3 && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-xs text-white/55 hover:text-white">
            {showAll ? 'Show fewer' : `Show all ${steps.length} suggestions`}
          </button>
        )}
      </div>
    </section>
  );
}
