'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { cart } from '@/lib/store/cart-client';

/**
 * PayFast sends buyers back here before (or after) its ITN reaches us, so
 * poll the order for a minute until it shows as paid.
 */
export default function ThankYouClient({ number, initialStatus, email }: { number: string; initialStatus: string; email: string }) {
  const [status, setStatus] = useState(initialStatus);

  // The order exists and the buyer came back from PayFast — the cart has done its job.
  useEffect(() => { if (status !== 'CANCELLED') cart.clear(); }, [status]);

  useEffect(() => {
    if (status !== 'PENDING_PAYMENT') return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      try {
        const res = await fetch(`/api/store/orders/${encodeURIComponent(number)}`, { cache: 'no-store' });
        if (res.ok) {
          const d = await res.json() as { status: string };
          if (d.status !== 'PENDING_PAYMENT') { setStatus(d.status); clearInterval(t); }
        }
      } catch { /* retry */ }
      if (tries >= 20) clearInterval(t);
    }, 3000);
    return () => clearInterval(t);
  }, [number, status]);

  const paid = !['PENDING_PAYMENT', 'CANCELLED', 'REFUNDED'].includes(status);
  return (
    <div className="max-w-xl mx-auto px-4 pt-12 sm:pt-20 text-center">
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div aria-hidden="true" className="absolute inset-0 rounded-full bg-[#DC143C]/20 blur-2xl" />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#DC143C]/25 to-[#D4AF37]/10 border border-white/10 flex items-center justify-center">
          {paid ? <CheckCircle2 size={34} className="text-[#F5D77A]" aria-hidden="true" /> : status === 'PENDING_PAYMENT' ? <Loader2 size={30} className="text-white/70 animate-spin" aria-hidden="true" /> : <Clock size={30} className="text-white/60" aria-hidden="true" />}
        </div>
      </div>
      <div aria-live="polite">
        {paid ? (
          <>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white">Thank you</h1>
            <p className="text-white/70 mt-3">Order <span className="text-white font-semibold">{number}</span> is confirmed. We’ve sent the details to {email}, and we’ll let you know when it ships — in plain packaging.</p>
          </>
        ) : status === 'PENDING_PAYMENT' ? (
          <>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white">Confirming payment…</h1>
            <p className="text-white/70 mt-3">This usually takes a few seconds. You can safely leave this page — order <span className="text-white font-semibold">{number}</span> updates automatically.</p>
          </>
        ) : (
          <>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white">Order {status === 'REFUNDED' ? 'refunded' : 'cancelled'}</h1>
            <p className="text-white/70 mt-3">Order {number} isn’t active. If you were charged, contact support and we’ll sort it out.</p>
          </>
        )}
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
        <Link href={`/store/orders/${number}`} className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-7 py-3 rounded-xl font-semibold text-sm">View order</Link>
        <Link href="/store" className="glass border border-white/15 text-white/85 hover:text-white px-6 py-3 rounded-xl text-sm">Continue shopping</Link>
      </div>
    </div>
  );
}
