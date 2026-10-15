import Link from 'next/link';
import { foundingSpots } from '@/lib/founding';

/** Landing-page offer: "First 30 women & couples get Platinum free forever — N spots left". */
export default async function FoundingOffer() {
  const spots = await foundingSpots().catch(() => null);
  if (!spots || spots.left <= 0) return null;
  return (
    <Link
      href="/auth/signup"
      className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 rounded-full text-xs sm:text-sm border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#F5D77A] hover:bg-[#D4AF37]/20 transition-colors mb-6"
    >
      <span aria-hidden="true">👑</span>
      <span>
        Founding offer: the first {spots.limit} women &amp; couples get <strong className="text-white">Platinum free, forever</strong>
      </span>
      <span className="text-white/80">· {spots.left} {spots.left === 1 ? 'spot' : 'spots'} left</span>
    </Link>
  );
}
