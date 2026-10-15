'use client';

import { useState } from 'react';
import { Check, Minus } from 'lucide-react';
import { PLAN_FEATURES, type PlanTier } from '@/lib/plans';

const TIERS: { tier: PlanTier; label: string; accent: string }[] = [
  { tier: 'FREE', label: 'Free', accent: 'text-white' },
  { tier: 'GOLD', label: 'Gold', accent: 'text-[#D4AF37]' },
  { tier: 'PLATINUM', label: 'Platinum', accent: 'text-purple-300' },
];

function Value({ v, tier }: { v: boolean | string; tier: PlanTier }) {
  if (v === true) {
    return (
      <span className="inline-flex items-center justify-center">
        <Check size={16} className={tier === 'GOLD' ? 'text-[#D4AF37]' : tier === 'PLATINUM' ? 'text-purple-300' : 'text-emerald-400'} aria-hidden="true" />
        <span className="sr-only">Included</span>
      </span>
    );
  }
  if (v === false) {
    return (
      <span className="inline-flex items-center justify-center">
        <Minus size={14} className="text-white/25" aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  return <span className="text-white/85 text-sm font-medium">{v}</span>;
}

/**
 * Feature comparison rendered from lib/plans.ts PLAN_FEATURES, so the page can
 * never promise something the code doesn't enforce.
 * Desktop: a 3-column table. Mobile: a tier switcher showing one plan at a time.
 */
export default function PlanComparison({ current, highlight = 'GOLD' }: { current?: PlanTier | null; highlight?: PlanTier }) {
  const [mobileTier, setMobileTier] = useState<PlanTier>(current && current !== 'FREE' ? current : highlight);

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden md:block glass rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <caption className="sr-only">What each Unbound plan includes</caption>
          <thead>
            <tr className="border-b border-white/10">
              <th scope="col" className="p-4 text-white/55 text-xs font-semibold uppercase tracking-wider w-[40%]">Feature</th>
              {TIERS.map(({ tier, label, accent }) => (
                <th key={tier} scope="col" className={`p-4 text-center ${tier === highlight ? 'bg-[#D4AF37]/[0.06]' : ''}`}>
                  <span className={`font-serif text-lg font-bold ${accent}`}>{label}</span>
                  {tier === highlight && <span className="block text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] mt-0.5">Recommended</span>}
                  {current === tier && <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/55 mt-0.5">Your plan</span>}
                </th>
              ))}
            </tr>
          </thead>
          {PLAN_FEATURES.map((group) => (
            <tbody key={group.group}>
              <tr>
                <th colSpan={4} scope="colgroup" className="px-4 pt-6 pb-2 eyebrow text-[#DC143C]">{group.group}</th>
              </tr>
              {group.items.map((item) => (
                <tr key={item.label} className="border-t border-white/5">
                  <th scope="row" className="px-4 py-3 text-white/80 text-sm font-normal">{item.label}</th>
                  {TIERS.map(({ tier }) => (
                    <td key={tier} className={`px-4 py-3 text-center ${tier === highlight ? 'bg-[#D4AF37]/[0.06]' : ''}`}>
                      <Value v={item.values[tier]} tier={tier} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {/* Mobile: tier switcher */}
      <div className="md:hidden">
        <div role="tablist" aria-label="Choose a plan to compare" className="grid grid-cols-3 gap-1 glass rounded-xl p-1 mb-4">
          {TIERS.map(({ tier, label }) => (
            <button
              key={tier}
              role="tab"
              aria-selected={mobileTier === tier}
              onClick={() => setMobileTier(tier)}
              className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                mobileTier === tier
                  ? tier === 'GOLD' ? 'bg-[#D4AF37] text-[#0A0A0F]' : tier === 'PLATINUM' ? 'bg-purple-600 text-white' : 'bg-white text-[#0A0A0F]'
                  : 'text-white/65'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="glass rounded-2xl p-4">
          {mobileTier === highlight && <p className="text-[#D4AF37] text-xs font-bold uppercase tracking-wider mb-2">Recommended</p>}
          {current === mobileTier && <p className="text-white/55 text-xs font-semibold uppercase tracking-wider mb-2">Your plan</p>}
          {PLAN_FEATURES.map((group) => (
            <div key={group.group} className="mb-4 last:mb-0">
              <p className="eyebrow text-[#DC143C] mb-2">{group.group}</p>
              <ul className="divide-y divide-white/5">
                {group.items.map((item) => {
                  const v = item.values[mobileTier];
                  return (
                    <li key={item.label} className={`flex items-center justify-between gap-3 py-2.5 ${v === false ? 'opacity-60' : ''}`}>
                      <span className="text-white/80 text-sm">{item.label}</span>
                      <Value v={v} tier={mobileTier} />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
