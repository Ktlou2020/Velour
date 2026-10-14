'use client';

import { useState } from 'react';
import { Check, ShoppingBag } from 'lucide-react';
import { cart, useCart } from '@/lib/store/cart-client';
import { MAX_QTY_PER_LINE } from '@/lib/store/config';
import { useToast } from '@/lib/toast-context';
import QuantityStepper from './QuantityStepper';
import { useStore } from './StoreProvider';

interface Props {
  product: { id: string; slug: string; name: string; image: string | null; priceCents: number; stock: number };
}

export default function AddToCart({ product }: Props) {
  const { openDrawer } = useStore();
  const { showToast } = useToast();
  const items = useCart();
  const inCart = items.find((i) => i.productId === product.id)?.quantity ?? 0;
  const maxAddable = Math.max(0, Math.min(product.stock, MAX_QTY_PER_LINE) - inCart);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const soldOut = product.stock <= 0;
  const q = Math.min(qty, Math.max(1, maxAddable));

  function add() {
    if (maxAddable <= 0) return;
    const now = cart.add({ productId: product.id, slug: product.slug, name: product.name, image: product.image, priceCents: product.priceCents, stock: product.stock }, q);
    if (now > 0) {
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
      setQty(1);
      openDrawer();
    } else {
      showToast('That item is out of stock', 'error');
    }
  }

  if (soldOut) {
    return <button type="button" disabled className="w-full sm:w-auto px-8 h-12 rounded-xl bg-white/10 text-white/50 font-semibold cursor-not-allowed">Sold out</button>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <QuantityStepper value={q} max={Math.max(1, maxAddable)} onChange={setQty} label="Quantity" disabled={maxAddable <= 0} />
        <button type="button" onClick={add} disabled={maxAddable <= 0}
          className="flex-1 sm:flex-none sm:px-8 h-11 rounded-xl bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white font-semibold inline-flex items-center justify-center gap-2 shadow-lg shadow-[#DC143C]/20 disabled:opacity-50 disabled:cursor-not-allowed">
          {added ? <Check size={17} aria-hidden="true" /> : <ShoppingBag size={17} aria-hidden="true" />}
          {added ? 'Added' : 'Add to cart'}
        </button>
      </div>
      {inCart > 0 && (
        <p className="text-xs text-white/55">{inCart} in your cart{maxAddable <= 0 ? ' — that’s all we have available' : ''}.</p>
      )}
    </div>
  );
}
