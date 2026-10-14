import { Droplets, Gem, Gift, HeartHandshake, Sparkles, type LucideIcon } from 'lucide-react';

const PALETTES = [
  'from-[#3a0b17] via-[#1a0d1f] to-[#0d0a14]',
  'from-[#2b1a08] via-[#1a1210] to-[#0d0a10]',
  'from-[#1f0b2b] via-[#140c1d] to-[#0a0a12]',
  'from-[#2d0a1a] via-[#1d0f14] to-[#0c0a0f]',
];

function iconFor(category: string | null | undefined, name: string): LucideIcon {
  const s = `${category ?? ''} ${name}`.toLowerCase();
  if (/(lube|lubric|wellness|oil|care|clean)/.test(s)) return Droplets;
  if (/(couple|duo|duet|together|set)/.test(s)) return HeartHandshake;
  if (/(him|men|sleeve)/.test(s)) return Gem;
  if (/(vibr|wand|massag|mini)/.test(s)) return Sparkles;
  return Gift;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Elegant text-free tile for products without photos (no imagery, just an icon on a gradient). */
export default function ProductPlaceholder({ name, category, size = 'md', className = '' }: { name: string; category?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const Icon = iconFor(category, name);
  const palette = PALETTES[hash(name) % PALETTES.length];
  const icon = size === 'lg' ? 56 : size === 'sm' ? 20 : 34;
  return (
    <div className={`relative w-full h-full bg-gradient-to-br ${palette} flex items-center justify-center overflow-hidden ${className}`} aria-hidden="true">
      <div className="absolute -top-1/4 -right-1/4 w-3/4 h-3/4 rounded-full bg-[#DC143C]/10 blur-3xl" />
      <div className="absolute -bottom-1/4 -left-1/4 w-2/3 h-2/3 rounded-full bg-[#D4AF37]/10 blur-3xl" />
      <div className={`relative rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center ${size === 'lg' ? 'w-32 h-32' : size === 'sm' ? 'w-10 h-10' : 'w-20 h-20'}`}>
        <Icon size={icon} strokeWidth={1.25} className="text-[#F5D77A]/80" />
      </div>
    </div>
  );
}
