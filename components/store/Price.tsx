import { formatRand } from '@/lib/store/format';

interface Props {
  cents: number;
  compareAtCents?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showVat?: boolean;
  className?: string;
}

/** "R 1 299.00 incl. VAT" with an optional struck-through compare-at price. */
export default function Price({ cents, compareAtCents, size = 'md', showVat = true, className = '' }: Props) {
  const main = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-sm' : 'text-base';
  const sale = !!compareAtCents && compareAtCents > cents;
  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`}>
      <span className={`${main} font-semibold tabular-nums ${sale ? 'text-[#F5D77A]' : 'text-white'}`}>{formatRand(cents)}</span>
      {sale && (
        <span className={`${size === 'lg' ? 'text-base' : 'text-xs'} text-white/45 line-through tabular-nums`}>
          <span className="sr-only">Was </span>{formatRand(compareAtCents!)}
        </span>
      )}
      {showVat && <span className={`${size === 'lg' ? 'text-xs' : 'text-[10px]'} text-white/45 uppercase tracking-wide`}>incl. VAT</span>}
    </div>
  );
}
