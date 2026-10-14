'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2, X } from 'lucide-react';
import { submitPayfastForm } from '@/lib/store/cart-client';

/** "Pay now" (fresh signed PayFast form) and "Cancel order" for an unpaid order. */
export default function PayNowButton({ number, minutesLeft, showCancel = true }: { number: string; minutesLeft: number; showCancel?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'pay' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy('pay'); setError(null);
    try {
      const res = await fetch(`/api/store/orders/${encodeURIComponent(number)}/pay`, { method: 'POST' });
      const d = await res.json().catch(() => ({})) as { error?: string; payfast?: { action: string; fields: [string, string][] } };
      if (!res.ok || !d.payfast) { setError(d.error ?? 'Couldn’t start payment'); setBusy(null); router.refresh(); return; }
      submitPayfastForm(d.payfast);
    } catch {
      setError('Couldn’t start payment — check your connection'); setBusy(null);
    }
  }

  async function cancel() {
    if (!confirm('Cancel this order? The items go back on the shelf.')) return;
    setBusy('cancel'); setError(null);
    try {
      const res = await fetch(`/api/store/orders/${encodeURIComponent(number)}/cancel`, { method: 'POST' });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) setError(d.error ?? 'Couldn’t cancel the order');
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={pay} disabled={!!busy || minutesLeft <= 0}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-6 h-11 rounded-xl font-semibold text-sm disabled:opacity-50">
          {busy === 'pay' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <CreditCard size={16} aria-hidden="true" />}Pay now
        </button>
        {showCancel && (
          <button type="button" onClick={cancel} disabled={!!busy}
            className="inline-flex items-center gap-2 glass border border-white/15 text-white/80 hover:text-white px-5 h-11 rounded-xl text-sm disabled:opacity-50">
            {busy === 'cancel' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <X size={16} aria-hidden="true" />}Cancel order
          </button>
        )}
      </div>
      {minutesLeft > 0 && <p className="text-xs text-white/50 mt-2">Items are reserved for another {minutesLeft} minute{minutesLeft === 1 ? '' : 's'}.</p>}
      {error && <p role="alert" className="text-sm text-red-300 mt-2">{error}</p>}
    </div>
  );
}
