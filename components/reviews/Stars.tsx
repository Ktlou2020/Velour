import { Star } from 'lucide-react';

/** Read-only star row, e.g. 4 of 5 filled. Decorative: pair with a text label. */
export function Stars({ value, size = 12, className = '' }: { value: number; size?: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= full ? 'text-[#D4AF37] fill-[#D4AF37]' : 'text-white/20'} />
      ))}
    </span>
  );
}

/** Small "★ 4.8 (12)" chip for member cards. Renders nothing without reviews. */
export function RatingChip({ rating, className = '', variant = 'glass' }: {
  rating?: { avg: number; count: number } | null;
  className?: string;
  variant?: 'glass' | 'plain';
}) {
  if (!rating || rating.count < 1) return null;
  const label = `Rated ${rating.avg.toFixed(1)} out of 5 from ${rating.count} review${rating.count === 1 ? '' : 's'}`;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold leading-none ${variant === 'glass' ? 'px-1.5 py-1 rounded-md glass' : ''} text-[#F5D77A] ${className}`}
      title={label}
      aria-label={label}
    >
      <Star size={9} className="fill-[#D4AF37] text-[#D4AF37]" aria-hidden="true" />
      {rating.avg.toFixed(1)}
      <span className="text-white/60 font-semibold">({rating.count})</span>
    </span>
  );
}
