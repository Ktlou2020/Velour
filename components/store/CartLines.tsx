'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import ProtectedImage from '@/components/ProtectedImage';
import { cart, type CartItem } from '@/lib/store/cart-client';
import { MAX_QTY_PER_LINE } from '@/lib/store/config';
import { formatRand } from '@/lib/store/format';
import ProductPlaceholder from './ProductPlaceholder';
import QuantityStepper from './QuantityStepper';

export default function CartLines({ items, onNavigate, compact = false, readOnly = false }: { items: CartItem[]; onNavigate?: () => void; compact?: boolean; readOnly?: boolean }) {
  return (
    <ul className="divide-y divide-white/5">
      {items.map((i) => (
        <li key={i.productId} className="flex gap-3 py-3">
          <Link href={`/store/p/${i.slug}`} onClick={onNavigate} className={`${compact ? 'w-16 h-16' : 'w-20 h-20 sm:w-24 sm:h-24'} rounded-xl overflow-hidden shrink-0 border border-white/10`}>
            {i.image ? <ProtectedImage src={i.image} alt="" className="w-full h-full" /> : <ProductPlaceholder name={i.name} size="sm" />}
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/store/p/${i.slug}`} onClick={onNavigate} className="text-white text-sm font-medium leading-snug line-clamp-2 hover:text-[#FF85A1]">{i.name}</Link>
              <span className="text-white text-sm font-semibold tabular-nums whitespace-nowrap">{formatRand(i.priceCents * i.quantity)}</span>
            </div>
            <p className="text-white/45 text-xs mt-0.5 tabular-nums">{formatRand(i.priceCents)} each</p>
            {readOnly ? (
              <p className="text-white/60 text-xs mt-1">Qty {i.quantity}</p>
            ) : (
              <div className="flex items-center gap-3 mt-2">
                <QuantityStepper size="sm" value={i.quantity} max={Math.max(1, Math.min(i.stock, MAX_QTY_PER_LINE))} label={`Quantity of ${i.name}`}
                  onChange={(n) => cart.setQuantity(i.productId, n)} />
                <button type="button" onClick={() => cart.remove(i.productId)} className="text-white/45 hover:text-[#FF4D6D] p-1.5 rounded-lg" aria-label={`Remove ${i.name}`}>
                  <Trash2 size={15} />
                </button>
                {i.stock > 0 && i.quantity >= i.stock && <span className="text-[11px] text-[#F5D77A]">Max available</span>}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
