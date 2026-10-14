'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ShoppingBag, X } from 'lucide-react';
import { cartSubtotal } from '@/lib/store/cart-client';
import { STORE_NAME } from '@/lib/store/config';
import CartLines from './CartLines';
import CartSummary from './CartSummary';
import { useStore } from './StoreProvider';
import { useQuote } from './useQuote';

export default function CartDrawer() {
  const { drawerOpen, closeDrawer } = useStore();
  const { items, notice } = useQuote(drawerOpen);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
      if (e.key === 'Tab' && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;
  const subtotal = cartSubtotal(items);

  // Portal to <body>: the page-transition wrapper creates a stacking context that
  // would otherwise leave the mobile tab bar on top of the drawer's buttons.
  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={`${STORE_NAME} cart`}>
      <button type="button" aria-label="Close cart" tabIndex={-1} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDrawer} />
      <div ref={panelRef} className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#0E0E15] border-l border-white/10 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/10">
          <h2 className="text-white font-serif text-xl font-bold flex items-center gap-2"><ShoppingBag size={18} className="text-[#D4AF37]" />Your cart</h2>
          <button ref={closeRef} type="button" onClick={closeDrawer} className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5" aria-label="Close cart"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5">
          {notice && <p role="status" className="mt-4 text-xs text-[#F5D77A] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-xl px-3 py-2">{notice}</p>}
          {items.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag size={32} className="mx-auto text-white/25 mb-3" aria-hidden="true" />
              <p className="text-white/70">Your cart is empty.</p>
              <Link href="/store" onClick={closeDrawer} className="inline-block mt-4 text-sm text-[#FF4D6D] hover:underline">Browse {STORE_NAME}</Link>
            </div>
          ) : (
            <CartLines items={items} onNavigate={closeDrawer} compact />
          )}
        </div>
        {items.length > 0 && (
          <div className="border-t border-white/10 p-5 space-y-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <CartSummary subtotalCents={subtotal} />
            <div className="grid grid-cols-2 gap-3">
              <Link href="/store/cart" onClick={closeDrawer} className="glass border border-white/15 text-white/85 hover:text-white rounded-xl py-3 text-center text-sm font-medium">View cart</Link>
              <Link href="/store/checkout" onClick={closeDrawer} className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white rounded-xl py-3 text-center text-sm font-semibold">Checkout</Link>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
