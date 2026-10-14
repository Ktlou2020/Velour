'use client';

import Link from 'next/link';
import { Lock, ShoppingBag } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import CartLines from '@/components/store/CartLines';
import CartSummary from '@/components/store/CartSummary';
import { useQuote } from '@/components/store/useQuote';
import { cartSubtotal } from '@/lib/store/cart-client';
import { STORE_NAME } from '@/lib/store/config';

export default function CartPageClient() {
  const { items, quote, loading, notice } = useQuote();
  const subtotal = cartSubtotal(items);

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 sm:pt-10">
      <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-6">Your cart</h1>
      {items.length === 0 ? (
        <div className="glass rounded-3xl">
          <EmptyState icon={ShoppingBag} title="Your cart is empty" description={`Have a browse — everything at ${STORE_NAME} ships discreetly.`} action={{ label: `Shop ${STORE_NAME}`, href: '/store' }} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px] items-start">
          <section className="glass rounded-2xl px-4 sm:px-6 py-2" aria-label="Items">
            {notice && <p role="status" className="mt-3 text-xs text-[#F5D77A] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-xl px-3 py-2">{notice}</p>}
            <CartLines items={items} />
          </section>
          <aside className="glass rounded-2xl p-5 lg:sticky lg:top-36" aria-label="Order summary">
            <h2 className="text-white font-semibold mb-4">Summary</h2>
            <CartSummary subtotalCents={quote && !loading ? quote.subtotalCents : subtotal} shippingCents={quote && !loading ? quote.shippingCents : undefined} totalCents={quote && !loading ? quote.totalCents : undefined} />
            <Link href="/store/checkout" className="mt-5 flex items-center justify-center gap-2 w-full bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white rounded-xl h-12 font-semibold shadow-lg shadow-[#DC143C]/20">
              <Lock size={15} aria-hidden="true" />Checkout
            </Link>
            <Link href="/store" className="block text-center text-sm text-white/55 hover:text-white mt-3">Continue shopping</Link>
          </aside>
        </div>
      )}
    </div>
  );
}
