import Link from 'next/link';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { mark: string; letter: string; word: string }> = {
  sm: { mark: 'w-7 h-7 rounded-lg', letter: 'text-base', word: 'text-lg' },
  md: { mark: 'w-8 h-8 rounded-lg', letter: 'text-lg', word: 'text-xl' },
  lg: { mark: 'w-12 h-12 rounded-xl', letter: 'text-2xl', word: 'text-3xl' },
};

/** The Hush monogram on its own (decorative). */
export function LogoMark({ size = 'md', className = '' }: { size?: Size; className?: string }) {
  const s = SIZES[size];
  return (
    <span
      aria-hidden="true"
      className={`${s.mark} inline-flex items-center justify-center bg-gradient-to-br from-[#DC143C] to-[#8F0D25] shadow-lg shadow-[#DC143C]/25 flex-shrink-0 ${className}`}
    >
      <span className={`text-white font-bold font-serif leading-none ${s.letter}`}>H</span>
    </span>
  );
}

/** Monogram + wordmark. Renders as a home link unless `href` is null. */
export default function Logo({
  size = 'md',
  href = '/',
  className = '',
}: {
  size?: Size;
  href?: string | null;
  className?: string;
}) {
  const s = SIZES[size];
  const inner = (
    <>
      <LogoMark size={size} />
      <span className={`text-white font-bold tracking-[0.2em] font-serif ${s.word}`}>HUSH</span>
    </>
  );
  if (href === null) {
    return <span className={`inline-flex items-center gap-2 ${className}`}>{inner}</span>;
  }
  return (
    <Link href={href} aria-label="Hush — home" className={`inline-flex items-center gap-2 ${className}`}>
      {inner}
    </Link>
  );
}
