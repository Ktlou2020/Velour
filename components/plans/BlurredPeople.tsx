import Link from 'next/link';
import { Lock } from 'lucide-react';
import PlanChip from './PlanChip';

const SWATCHES = [
  'from-rose-700 via-red-900 to-[#0A0A0F]',
  'from-amber-600 via-rose-900 to-[#0A0A0F]',
  'from-purple-700 via-indigo-900 to-[#0A0A0F]',
  'from-pink-600 via-rose-900 to-[#0A0A0F]',
  'from-emerald-700 via-teal-900 to-[#0A0A0F]',
  'from-sky-700 via-indigo-900 to-[#0A0A0F]',
];

/**
 * Locked preview of people (who liked / viewed you) for plans without access.
 * Deliberately renders abstract, blurred shapes — no names, photos or
 * initials ever reach the client, so the lock can't be peeked through.
 */
export default function BlurredPeople({
  count, headline, body, tier = 'GOLD', shape = 'card', max = 6, cta = 'See who with Gold',
}: {
  count: number;
  headline: string;
  body: string;
  tier?: 'GOLD' | 'PLATINUM';
  shape?: 'card' | 'avatar';
  max?: number;
  cta?: string;
}) {
  const tiles = Math.max(1, Math.min(count, max));
  return (
    <div className="glass rounded-3xl p-5 sm:p-7 border border-[#D4AF37]/15">
      <div className={shape === 'card' ? 'grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6' : 'flex justify-center -space-x-3 mb-6'} aria-hidden="true">
        {Array.from({ length: tiles }).map((_, i) => (
          <div
            key={i}
            className={`relative overflow-hidden bg-gradient-to-br ${SWATCHES[i % SWATCHES.length]} ${
              shape === 'card' ? 'aspect-[3/4] rounded-2xl' : 'w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-[#0A0A0F]'
            }`}
          >
            <div className="absolute inset-0 backdrop-blur-xl" />
            <div className={`absolute rounded-full bg-white/25 blur-md ${shape === 'card' ? 'w-1/2 aspect-square left-1/4 top-[22%]' : 'w-1/2 h-1/2 left-1/4 top-1/4'}`} />
            {shape === 'card' && <div className="absolute w-3/4 h-1/3 left-[12.5%] bottom-0 rounded-t-full bg-white/15 blur-md" />}
          </div>
        ))}
      </div>
      <div className="text-center max-w-md mx-auto">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Lock size={14} className="text-[#D4AF37]" aria-hidden="true" />
          <PlanChip tier={tier} locked={false} />
        </div>
        <h2 className="font-serif text-white text-2xl font-bold mb-2 text-balance">{headline}</h2>
        <p className="text-white/65 text-sm leading-relaxed mb-5">{body}</p>
        <Link
          href="/upgrade#compare"
          className="inline-flex items-center justify-center bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] font-bold px-6 py-2.5 rounded-xl text-sm hover:from-[#F4D03F] hover:to-[#D4AF37] transition-all"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
