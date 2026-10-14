'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Ban, CheckCircle2, Home, Loader2, Package, PackageCheck, ReceiptText, RotateCcw, Search, Truck, X } from 'lucide-react';
import OrderTimeline from '@/components/store/OrderTimeline';
import StatusPill from '@/components/store/StatusPill';
import { COURIERS } from '@/lib/store/config';
import { formatDateTime, formatRand } from '@/lib/store/format';

interface Row {
  id: string; number: string; status: string; totalCents: number; recipientName: string; city: string; province: string;
  discreetPackaging: boolean; createdAt: string; paidAt: string | null; user: { username: string }; _count: { items: number };
}
interface Summary { orders30: number; revenue30Cents: number; byStatus: Record<string, number> }
interface Detail {
  id: string; number: string; status: string; subtotalCents: number; shippingCents: number; totalCents: number;
  recipientName: string; phone: string; email: string; addressLine1: string; addressLine2: string | null; suburb: string | null;
  city: string; province: string; postalCode: string; deliveryNotes: string | null; discreetPackaging: boolean;
  courier: string | null; trackingNumber: string | null; paymentRef: string; pfPaymentId: string | null;
  paidAt: string | null; cancelledAt: string | null; shippedAt: string | null; deliveredAt: string | null; adminNotes: string | null; createdAt: string;
  items: { id: string; name: string; priceCents: number; quantity: number; productId: string | null; product: { slug: string; sku: string | null; stock: number } | null }[];
  user: { id: string; username: string; email: string };
}

const FILTERS = [
  { key: 'OPEN', label: 'To fulfil' },
  { key: 'PENDING_PAYMENT', label: 'Awaiting payment' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'DELIVERED', label: 'Delivered' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'REFUNDED', label: 'Refunded' },
  { key: '', label: 'All' },
];

const ACTION_UI: Record<string, { label: string; icon: typeof Truck; cls: string; confirm?: string }> = {
  PROCESSING: { label: 'Mark processing', icon: PackageCheck, cls: 'bg-sky-500/20 text-sky-200 hover:bg-sky-500/30' },
  SHIPPED: { label: 'Mark shipped', icon: Truck, cls: 'bg-violet-500/20 text-violet-200 hover:bg-violet-500/30' },
  DELIVERED: { label: 'Mark delivered', icon: Home, cls: 'bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30' },
  CANCELLED: { label: 'Cancel order', icon: Ban, cls: 'bg-red-500/15 text-red-200 hover:bg-red-500/25', confirm: 'Cancel this order? Unshipped items go back into stock. If it was paid, refund it in the PayFast dashboard too.' },
  REFUNDED: { label: 'Mark refunded', icon: RotateCcw, cls: 'glass text-white/80 hover:text-white', confirm: 'Mark as refunded? Do the actual refund in the PayFast dashboard first. Unshipped items go back into stock.' },
};

export default function AdminOrdersClient() {
  const [filter, setFilter] = useState('OPEN');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/store/orders?status=${filter}&q=${encodeURIComponent(q)}`).catch(() => null);
    const d = res?.ok ? await res.json() as { orders: Row[]; summary: Summary } : { orders: [], summary: null };
    setRows(d.orders); setSummary(d.summary);
  }, [filter, q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    if (id) setOpenId(id);
  }, []);

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <h1 className="text-white text-2xl font-bold font-serif flex items-center gap-2 mb-5"><ReceiptText className="text-[#D4AF37]" size={20} />Store orders</h1>
      {summary && (
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <li className="glass rounded-2xl p-4"><p className="text-white/45 text-xs">Paid orders, 30 days</p><p className="text-white text-xl font-semibold tabular-nums mt-1">{summary.orders30}</p></li>
          <li className="glass rounded-2xl p-4"><p className="text-white/45 text-xs">Revenue, 30 days</p><p className="text-white text-xl font-semibold tabular-nums mt-1">{formatRand(summary.revenue30Cents)}</p></li>
          <li className="glass rounded-2xl p-4"><p className="text-white/45 text-xs">To fulfil</p><p className="text-white text-xl font-semibold tabular-nums mt-1">{(summary.byStatus.PAID ?? 0) + (summary.byStatus.PROCESSING ?? 0)}</p></li>
          <li className="glass rounded-2xl p-4"><p className="text-white/45 text-xs">Awaiting payment</p><p className="text-white text-xl font-semibold tabular-nums mt-1">{summary.byStatus.PENDING_PAYMENT ?? 0}</p></li>
        </ul>
      )}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[12rem]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" aria-hidden="true" />
          <label htmlFor="o-search" className="sr-only">Search orders</label>
          <input id="o-search" value={q} onChange={(e) => setQ(e.target.value.slice(0, 80))} placeholder="Order number, name, email, username" className="input-dark w-full !pl-9 !py-2 text-sm" />
        </div>
      </div>
      <div className="flex gap-1 flex-wrap mb-4" role="tablist" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button key={f.key || 'all'} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-2 rounded-xl text-xs font-medium ${filter === f.key ? 'bg-[#DC143C]/20 text-[#FF4D6D]' : 'glass text-white/60 hover:text-white'}`}>
            {f.label}{f.key && summary?.byStatus && f.key !== 'OPEN' && summary.byStatus[f.key] ? ` · ${summary.byStatus[f.key]}` : ''}
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center"><CheckCircle2 className="text-emerald-400 mx-auto mb-2" size={26} /><p className="text-white/50 text-sm">No orders here</p></div>
      ) : (
        <ul className="space-y-2">
          {rows.map((o) => (
            <li key={o.id}>
              <button onClick={() => setOpenId(o.id)} className="w-full text-left glass rounded-xl p-3 sm:p-4 flex items-center gap-3 hover:border-white/20">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-semibold text-sm tabular-nums">{o.number}</span>
                    <StatusPill status={o.status} />
                    {o.discreetPackaging && <span className="text-[10px] text-[#F5D77A] border border-[#D4AF37]/30 rounded-full px-1.5 py-0.5">Discreet</span>}
                  </div>
                  <p className="text-white/45 text-xs mt-0.5 truncate">{o.recipientName} · {o.city}, {o.province} · @{o.user.username} · {formatDateTime(o.createdAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white text-sm font-semibold tabular-nums">{formatRand(o.totalCents)}</p>
                  <p className="text-white/40 text-xs">{o._count.items} line{o._count.items === 1 ? '' : 's'}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {openId && <OrderPanel id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

function OrderPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<{ order: Detail; actions: string[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [courier, setCourier] = useState(COURIERS[0].name);
  const [courierOther, setCourierOther] = useState('');
  const [tracking, setTracking] = useState('');
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/store/orders/${id}`).catch(() => null);
    if (!res?.ok) { setError('Order not found'); return; }
    const d = await res.json() as { order: Detail; actions: string[] };
    setData(d); setNotes(d.order.adminNotes ?? '');
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function act(action: string) {
    const ui = ACTION_UI[action];
    if (ui?.confirm && !confirm(ui.confirm)) return;
    setError(null);
    const c = courier === 'Other' ? courierOther.trim() : courier;
    if (action === 'SHIPPED' && (!c || !tracking.trim())) { setError('Choose a courier and enter the tracking number (or tracking link).'); return; }
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/store/orders/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, courier: c, trackingNumber: tracking.trim(), note: note.trim() || undefined }),
      });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setError(d.error ?? 'Failed'); return; }
      setNote(''); await load(); onChanged();
    } finally { setBusy(null); }
  }

  async function saveNotes() {
    const res = await fetch(`/api/admin/store/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminNotes: notes }) });
    setNotesSaved(res.ok);
  }

  const o = data?.order;
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Order details">
      <button type="button" tabIndex={-1} aria-label="Close" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-[#0E0E15] border-l border-white/10 overflow-y-auto">
        <div className="sticky top-0 bg-[#0E0E15]/95 backdrop-blur flex items-center justify-between px-5 h-14 border-b border-white/10 z-10">
          <h2 className="text-white font-semibold tabular-nums">{o ? `Order ${o.number}` : 'Order'}</h2>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5"><X size={18} /></button>
        </div>
        {!o ? <div className="p-5">{error ? <p className="text-red-300 text-sm">{error}</p> : <div className="skeleton h-64 rounded-2xl" />}</div> : (
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-2 flex-wrap"><StatusPill status={o.status} /><span className="text-white/45 text-xs">Placed {formatDateTime(o.createdAt)}</span></div>
            <OrderTimeline status={o.status} createdAt={o.createdAt} paidAt={o.paidAt} shippedAt={o.shippedAt} deliveredAt={o.deliveredAt} cancelledAt={o.cancelledAt} />

            {o.discreetPackaging && (
              <p className="flex items-center gap-2 text-sm text-[#F5D77A] bg-[#D4AF37]/10 border border-[#D4AF37]/25 rounded-xl px-3 py-2"><Package size={15} />Discreet packaging requested — plain box, discreet sender name.</p>
            )}

            <section>
              <h3 className="text-white/60 text-xs uppercase tracking-wider mb-2">Items</h3>
              <ul className="divide-y divide-white/5 text-sm">
                {o.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3 py-2">
                    <span className="text-white/85">{i.quantity} × {i.product ? <Link href={`/admin/store/products/${i.productId}`} className="hover:text-[#FF85A1]">{i.name}</Link> : i.name}
                      {i.product?.sku && <span className="text-white/35 text-xs"> · {i.product.sku}</span>}</span>
                    <span className="text-white tabular-nums">{formatRand(i.priceCents * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="text-sm border-t border-white/10 pt-2 space-y-1">
                <div className="flex justify-between text-white/55"><span>Subtotal</span><span className="tabular-nums">{formatRand(o.subtotalCents)}</span></div>
                <div className="flex justify-between text-white/55"><span>Delivery</span><span className="tabular-nums">{o.shippingCents ? formatRand(o.shippingCents) : 'Free'}</span></div>
                <div className="flex justify-between text-white font-semibold"><span>Total</span><span className="tabular-nums">{formatRand(o.totalCents)}</span></div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <h3 className="text-white/60 text-xs uppercase tracking-wider mb-1">Ship to</h3>
                <address className="not-italic text-white/80 leading-relaxed">
                  {o.recipientName}<br />{o.addressLine1}<br />{o.addressLine2 && <>{o.addressLine2}<br /></>}{o.suburb && <>{o.suburb}<br /></>}
                  {o.city}, {o.postalCode}<br />{o.province}
                </address>
                <p className="text-white/55 mt-1">{o.phone}<br />{o.email}</p>
                {o.deliveryNotes && <p className="text-white/55 text-xs mt-2 whitespace-pre-line break-words">Notes: {o.deliveryNotes}</p>}
              </div>
              <div>
                <h3 className="text-white/60 text-xs uppercase tracking-wider mb-1">Customer & payment</h3>
                <p className="text-white/80">@{o.user.username}</p>
                <p className="text-white/45 text-xs break-all">{o.user.email}</p>
                <p className="text-white/45 text-xs mt-2 break-all">Ref {o.paymentRef}</p>
                {o.pfPaymentId && <p className="text-white/45 text-xs break-all">PayFast #{o.pfPaymentId}</p>}
                {o.paidAt && <p className="text-white/45 text-xs">Paid {formatDateTime(o.paidAt)}</p>}
                {o.courier && <p className="text-white/70 text-xs mt-2">{o.courier} · <span className="break-all">{o.trackingNumber}</span></p>}
              </div>
            </section>

            {data.actions.length > 0 && (
              <section className="glass rounded-2xl p-4 space-y-3">
                <h3 className="text-white text-sm font-semibold">Update status</h3>
                {data.actions.includes('SHIPPED') && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label htmlFor="o-courier" className="block text-xs text-white/55 mb-1">Courier</label>
                      <select id="o-courier" value={courier} onChange={(e) => setCourier(e.target.value)} className="input-dark w-full !py-2 text-sm">
                        {COURIERS.map((c) => <option key={c.name} value={c.name} className="bg-[#12121A]">{c.name}</option>)}
                      </select>
                      {courier === 'Other' && <input aria-label="Courier name" value={courierOther} onChange={(e) => setCourierOther(e.target.value)} placeholder="Courier name" className="input-dark w-full !py-2 text-sm mt-2" />}
                    </div>
                    <div>
                      <label htmlFor="o-tracking" className="block text-xs text-white/55 mb-1">Tracking number or link</label>
                      <input id="o-tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. TCG123456 or https://…" className="input-dark w-full !py-2 text-sm" />
                    </div>
                  </div>
                )}
                <div>
                  <label htmlFor="o-note" className="block text-xs text-white/55 mb-1">Note for the log (optional, not shown to the customer)</label>
                  <input id="o-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="input-dark w-full !py-2 text-sm" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.actions.map((a) => {
                    const ui = ACTION_UI[a];
                    const Icon = ui.icon;
                    return (
                      <button key={a} onClick={() => act(a)} disabled={!!busy} className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg disabled:opacity-50 ${ui.cls}`}>
                        {busy === a ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}{ui.label}
                      </button>
                    );
                  })}
                </div>
                {data.actions.includes('REFUNDED') && <p className="text-[11px] text-white/40">Refunds themselves are made in the PayFast dashboard; this only records them and emails the customer.</p>}
                {error && <p role="alert" className="text-red-300 text-sm">{error}</p>}
              </section>
            )}

            <section>
              <label htmlFor="o-notes" className="block text-white/60 text-xs uppercase tracking-wider mb-1">Admin notes</label>
              <textarea id="o-notes" rows={5} value={notes} onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }} className="input-dark w-full text-xs font-mono" />
              <div className="flex items-center gap-3 mt-2">
                <button onClick={saveNotes} className="text-xs glass text-white/80 hover:text-white px-3 py-1.5 rounded-lg">Save notes</button>
                {notesSaved && <span className="text-xs text-emerald-300">Saved</span>}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
