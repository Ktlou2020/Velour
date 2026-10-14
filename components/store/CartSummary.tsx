'use client';

import { Truck } from 'lucide-react';
import { formatRand } from '@/lib/store/format';
import { shippingFor } from '@/lib/store/pricing';
import { useStore } from './StoreProvider';

/** Subtotal / delivery / total. Uses the server quote when given, else a local estimate. */
export default function CartSummary({ subtotalCents, shippingCents, totalCents }: { subtotalCents: number; shippingCents?: number; totalCents?: number }) {
  const { settings } = useStore();
  const shipping = shippingCents ?? shippingFor(subtotalCents, settings);
  const total = totalCents ?? subtotalCents + shipping;
  const toFree = settings.freeShippingOverCents > 0 ? settings.freeShippingOverCents - subtotalCents : 0;
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between text-white/70"><span>Subtotal</span><span className="tabular-nums">{formatRand(subtotalCents)}</span></div>
      <div className="flex justify-between text-white/70"><span>Delivery</span><span className="tabular-nums">{shipping === 0 && subtotalCents > 0 ? 'Free' : formatRand(shipping)}</span></div>
      {toFree > 0 && subtotalCents > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-[#F5D77A]/90"><Truck size={13} aria-hidden="true" />Add {formatRand(toFree)} more for free delivery</p>
      )}
      <div className="flex justify-between text-white font-semibold text-base pt-2 border-t border-white/10">
        <span>Total</span><span className="tabular-nums">{formatRand(total)}</span>
      </div>
      <p className="text-[11px] text-white/45">All prices include 15% VAT. Delivery within South Africa only.</p>
    </div>
  );
}
