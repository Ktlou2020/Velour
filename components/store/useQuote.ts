'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cart, useCart } from '@/lib/store/cart-client';
import type { Quote } from '@/lib/store/orders';

/**
 * Re-price the cart from the server whenever its product/quantity set changes
 * and write the server's prices/stock back into the cart. `notice` explains
 * any adjustment (sold out, fewer left, price changed).
 */
export function useQuote(enabled = true) {
  const items = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const sig = items.map((i) => `${i.productId}:${i.quantity}`).join(',');
  const lastSig = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const current = cart.get();
    if (!current.length) { setQuote(null); return null; }
    setLoading(true);
    try {
      const res = await fetch('/api/store/cart/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: current.map((i) => ({ productId: i.productId, quantity: i.quantity })) }),
      });
      if (!res.ok) return null;
      const q = await res.json() as Quote;
      const before = new Map(current.map((i) => [i.productId, i]));
      const msgs: string[] = [];
      if (q.missing.length) msgs.push(`${q.missing.length === 1 ? 'An item is' : 'Some items are'} no longer available and ${q.missing.length === 1 ? 'was' : 'were'} removed.`);
      for (const l of q.lines) {
        const b = before.get(l.productId);
        if (l.quantity === 0) msgs.push(`${l.name} just sold out.`);
        else if (l.quantity < l.requested) msgs.push(`Only ${l.stock} × ${l.name} left — quantity updated.`);
        if (b && b.priceCents !== l.priceCents && b.priceCents > 0) msgs.push(`The price of ${l.name} changed.`);
      }
      setNotice(msgs.length ? msgs.join(' ') : null);
      cart.applyQuote(q.lines);
      lastSig.current = q.lines.filter((l) => l.quantity > 0).map((l) => `${l.productId}:${l.quantity}`).join(',');
      setQuote(q);
      return q;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    const t = setTimeout(() => { refresh(); }, 250);
    return () => clearTimeout(t);
  }, [sig, enabled, refresh]);

  return { items, quote, loading, notice, refresh, setNotice };
}
