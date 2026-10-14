'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Lock, Package, ShoppingBag } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import CartLines from '@/components/store/CartLines';
import CartSummary from '@/components/store/CartSummary';
import { useStore } from '@/components/store/StoreProvider';
import { useQuote } from '@/components/store/useQuote';
import { validateDelivery, type DeliveryErrors, type DeliveryInput } from '@/lib/store/address';
import { cart, cartSubtotal, submitPayfastForm } from '@/lib/store/cart-client';
import { SA_PROVINCES, STORE_NAME, STORE_TERMS_HREF } from '@/lib/store/config';
import type { Quote } from '@/lib/store/orders';

export type CheckoutPrefill = Omit<DeliveryInput, 'deliveryNotes'>;

const FIELD_ORDER: (keyof DeliveryInput)[] = ['recipientName', 'phone', 'email', 'addressLine1', 'addressLine2', 'suburb', 'city', 'province', 'postalCode', 'deliveryNotes'];

export default function CheckoutClient({ prefill, paymentsEnabled, hasPending }: { prefill: CheckoutPrefill; paymentsEnabled: boolean; hasPending: boolean }) {
  const { settings } = useStore();
  const { items, quote, notice, setNotice, refresh } = useQuote();
  const [form, setForm] = useState<DeliveryInput>({ ...prefill, deliveryNotes: '' });
  const [errors, setErrors] = useState<DeliveryErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(paymentsEnabled ? null : 'Payments aren’t set up yet, so checkout is paused. You can keep browsing and your cart will be saved.');

  const set = <K extends keyof DeliveryInput>(k: K, v: DeliveryInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { errors: errs } = validateDelivery(form as unknown as Record<string, unknown>);
    if (Object.keys(errs).length) {
      setErrors(errs);
      const first = FIELD_ORDER.find((k) => errs[k]);
      if (first) document.getElementById(`co-${first}`)?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const q = await refresh();
      if (!q || !q.lines.some((l) => l.quantity > 0)) { setSubmitting(false); return; }
      const res = await fetch('/api/store/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.get().map((i) => ({ productId: i.productId, quantity: i.quantity })),
          delivery: form,
          expectedTotalCents: q.totalCents,
        }),
      });
      const d = await res.json().catch(() => ({})) as { error?: string; code?: string; fields?: DeliveryErrors; quote?: Quote; payfast?: { action: string; fields: [string, string][] } };
      if (res.ok && d.payfast) {
        submitPayfastForm(d.payfast); // navigates away; cart is cleared once the order is paid
        return;
      }
      if (d.fields) setErrors(d.fields);
      if (d.quote) { cart.applyQuote(d.quote.lines); setNotice('Your cart was updated with the latest prices and stock — please check it and try again.'); }
      if (d.code === 'OUT_OF_STOCK') refresh();
      setError(d.error ?? 'Something went wrong — please try again');
    } catch {
      setError('Couldn’t reach the server — check your connection and try again');
    }
    setSubmitting(false);
  }

  if (items.length === 0) {
    return (
      <div className="glass rounded-3xl">
        <EmptyState icon={ShoppingBag} title="Your cart is empty" description="Add something you love, then come back to check out." action={{ label: `Shop ${STORE_NAME}`, href: '/store' }} />
      </div>
    );
  }

  const field = (k: keyof DeliveryInput, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, optional = false) => (
    <div>
      <label htmlFor={`co-${k}`} className="block text-sm text-white/75 mb-1.5">{label}{optional && <span className="text-white/40"> (optional)</span>}</label>
      <input id={`co-${k}`} value={String(form[k] ?? '')} onChange={(e) => set(k, e.target.value as never)}
        aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `co-${k}-err` : undefined}
        className={`input-dark w-full ${errors[k] ? '!border-red-400/70' : ''}`} {...props} />
      {errors[k] && <p id={`co-${k}-err`} className="text-xs text-red-300 mt-1">{errors[k]}</p>}
    </div>
  );

  const subtotal = cartSubtotal(items);

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
      <div className="space-y-6">
        <section className="glass rounded-2xl p-5 sm:p-6" aria-labelledby="co-delivery">
          <h2 id="co-delivery" className="text-white font-semibold text-lg mb-4">Delivery details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{field('recipientName', 'Recipient name', { autoComplete: 'name', maxLength: 100 })}</div>
            {field('phone', 'Phone', { type: 'tel', autoComplete: 'tel', inputMode: 'tel', placeholder: '082 123 4567', maxLength: 20 })}
            {field('email', 'Email', { type: 'email', autoComplete: 'email', maxLength: 200 })}
            <div className="sm:col-span-2">{field('addressLine1', 'Street address', { autoComplete: 'address-line1', maxLength: 120 })}</div>
            <div className="sm:col-span-2">{field('addressLine2', 'Apartment, complex, unit', { autoComplete: 'address-line2', maxLength: 120 }, true)}</div>
            {field('suburb', 'Suburb', { autoComplete: 'address-level3', maxLength: 80 }, true)}
            {field('city', 'City / town', { autoComplete: 'address-level2', maxLength: 80 })}
            <div>
              <label htmlFor="co-province" className="block text-sm text-white/75 mb-1.5">Province</label>
              <select id="co-province" value={form.province} onChange={(e) => set('province', e.target.value)} autoComplete="address-level1"
                aria-invalid={!!errors.province} aria-describedby={errors.province ? 'co-province-err' : undefined}
                className={`input-dark w-full ${errors.province ? '!border-red-400/70' : ''}`}>
                <option value="" className="bg-[#12121A]">Choose…</option>
                {SA_PROVINCES.map((p) => <option key={p} value={p} className="bg-[#12121A]">{p}</option>)}
              </select>
              {errors.province && <p id="co-province-err" className="text-xs text-red-300 mt-1">{errors.province}</p>}
            </div>
            {field('postalCode', 'Postal code', { inputMode: 'numeric', autoComplete: 'postal-code', maxLength: 4, pattern: '[0-9]{4}', placeholder: '0000' })}
            <div className="sm:col-span-2">
              <label htmlFor="co-deliveryNotes" className="block text-sm text-white/75 mb-1.5">Delivery notes <span className="text-white/40">(optional)</span></label>
              <textarea id="co-deliveryNotes" rows={2} maxLength={500} value={form.deliveryNotes} onChange={(e) => set('deliveryNotes', e.target.value)}
                placeholder="Gate code, best time to deliver…" className="input-dark w-full resize-none" />
            </div>
          </div>
          <p className="text-xs text-white/45 mt-3">We deliver within South Africa only.</p>
        </section>

        <section className="glass rounded-2xl p-5 sm:p-6" aria-labelledby="co-discreet">
          <h2 id="co-discreet" className="sr-only">Packaging</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={form.discreetPackaging} onChange={(e) => set('discreetPackaging', e.target.checked)} className="mt-1 w-4 h-4 accent-[#DC143C]" />
            <span>
              <span className="text-white font-medium flex items-center gap-2"><Package size={16} className="text-[#D4AF37]" aria-hidden="true" />Discreet packaging</span>
              <span className="block text-sm text-white/60 mt-1">Plain outer box with no product names or logos. Sender shown as “{settings.discreetSender}”.</span>
            </span>
          </label>
        </section>
      </div>

      <aside className="glass rounded-2xl p-5 lg:sticky lg:top-36" aria-label="Order summary">
        <h2 className="text-white font-semibold mb-2">Order summary</h2>
        {notice && <p role="status" className="mb-2 text-xs text-[#F5D77A] bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-xl px-3 py-2">{notice}</p>}
        <CartLines items={items} compact readOnly />
        <div className="border-t border-white/10 pt-3">
          <CartSummary subtotalCents={quote?.subtotalCents ?? subtotal} shippingCents={quote?.shippingCents} totalCents={quote?.totalCents} />
        </div>
        {error && <p role="alert" className="text-sm text-red-300 mt-4">{error}</p>}
        {hasPending && <p className="text-xs text-white/50 mt-3">Checking out again replaces your unpaid order.</p>}
        <button type="submit" disabled={submitting || !paymentsEnabled}
          className="mt-5 flex items-center justify-center gap-2 w-full bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white rounded-xl h-12 font-semibold shadow-lg shadow-[#DC143C]/20 disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />}
          {submitting ? 'Redirecting to PayFast…' : 'Pay securely with PayFast'}
        </button>
        <p className="text-[11px] text-white/45 mt-3 leading-relaxed">
          You’ll pay on PayFast’s secure page. Items are reserved for 30 minutes while you pay. By ordering you confirm you’re 18 or older and accept the <Link href={STORE_TERMS_HREF} className="text-[#FF4D6D] hover:underline">store terms</Link>.
        </p>
      </aside>
    </form>
  );
}
