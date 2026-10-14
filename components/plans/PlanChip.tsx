import { Lock } from 'lucide-react';

/** Small "Gold" / "Platinum" chip shown next to locked features. */
export default function PlanChip({ tier = 'GOLD', locked = true, className = '' }: { tier?: 'GOLD' | 'PLATINUM'; locked?: boolean; className?: string }) {
  const gold = tier === 'GOLD';
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide rounded-full px-1.5 py-px border whitespace-nowrap ${
        gold ? 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/30' : 'text-purple-300 bg-purple-500/10 border-purple-400/30'
      } ${className}`}
    >
      {locked && <Lock size={9} aria-hidden="true" />}
      {gold ? 'Gold' : 'Platinum'}
    </span>
  );
}
