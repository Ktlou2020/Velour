import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, Boxes, ExternalLink, ReceiptText, Store, Tags } from 'lucide-react';
import { requireAdmin } from '@/auth';
import { db } from '@/lib/db';
import { payfastConfig } from '@/lib/payfast';
import { paystackConfig } from '@/lib/paystack';
import { LOW_STOCK_THRESHOLD, STORE_NAME } from '@/lib/store/config';
import { formatRand } from '@/lib/store/format';
import { maybeReleaseExpired } from '@/lib/store/orders';
import SeedButton from './SeedButton';
import CJSyncButton from './CJSyncButton';

export const dynamic = 'force-dynamic';

export default async function AdminStorePage() {
  if (!(await requireAdmin())) redirect('/members');
  await maybeReleaseExpired();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const paid = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
  const [productCount, categoryCount, paid30, open, pending, lowStock] = await Promise.all([
    db.product.count(),
    db.productCategory.count(),
    db.order.aggregate({ where: { status: { in: paid }, paidAt: { gte: since } }, _sum: { totalCents: true }, _count: true }),
    db.order.count({ where: { status: { in: ['PAID', 'PROCESSING'] } } }),
    db.order.count({ where: { status: 'PENDING_PAYMENT' } }),
    db.product.findMany({ where: { isActive: true, stock: { lte: LOW_STOCK_THRESHOLD } }, orderBy: { stock: 'asc' }, take: 10, select: { id: true, name: true, stock: true } }),
  ]);
  const cfg = payfastConfig();
  const ps = paystackConfig();
  const revenue = paid30._sum.totalCents ?? 0;

  const stats = [
    { label: 'Paid orders (30 days)', value: String(paid30._count) },
    { label: 'Revenue (30 days)', value: formatRand(revenue) },
    { label: 'Average order', value: paid30._count ? formatRand(Math.round(revenue / paid30._count)) : '—' },
    { label: 'To fulfil', value: String(open), href: '/admin/store/orders?status=OPEN' },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h1 className="text-white text-2xl font-bold font-serif flex items-center gap-2"><Store className="text-[#D4AF37]" size={20} />{STORE_NAME}</h1>
        <Link href="/store" className="text-xs text-white/50 hover:text-white inline-flex items-center gap-1">View store <ExternalLink size={11} /></Link>
      </div>
      <p className="text-white/40 text-sm mb-6">{productCount} products · {categoryCount} categories · {pending} awaiting payment</p>

      {!cfg && !ps && (
        <div role="alert" className="mb-6 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-4 text-sm text-[#F5D77A] flex gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          No payment provider is configured (PAYSTACK_SECRET_KEY, or PAYFAST_MERCHANT_ID / PAYFAST_MERCHANT_KEY). Members can browse, but checkout is paused.
        </div>
      )}
      {ps && <p className="mb-6 text-xs text-white/50">Payments go through Paystack{ps.testMode ? <span className="text-sky-300"> (test mode — no real money moves)</span> : null}{cfg ? '; PayFast stays configured as the fallback.' : '.'}</p>}
      {!ps && cfg?.sandbox && <p className="mb-6 text-xs text-sky-300">PayFast sandbox mode is on — no real money moves.</p>}

      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {stats.map((s) => (
          <li key={s.label} className="glass rounded-2xl p-4">
            {s.href ? <Link href={s.href} className="block"><p className="text-white/45 text-xs">{s.label}</p><p className="text-white text-xl font-semibold mt-1 tabular-nums">{s.value}</p></Link>
              : <><p className="text-white/45 text-xs">{s.label}</p><p className="text-white text-xl font-semibold mt-1 tabular-nums">{s.value}</p></>}
          </li>
        ))}
      </ul>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        {[
          { href: '/admin/store/products', label: 'Products', icon: Boxes, body: 'Add, edit, stock and photos' },
          { href: '/admin/store/categories', label: 'Categories', icon: Tags, body: 'Names and order' },
          { href: '/admin/store/orders', label: 'Orders', icon: ReceiptText, body: 'Fulfil, ship, refund' },
        ].map(({ href, label, icon: Icon, body }) => (
          <Link key={href} href={href} className="glass rounded-2xl p-5 hover:border-white/20">
            <Icon size={18} className="text-[#FF4D6D] mb-2" />
            <p className="text-white font-semibold">{label}</p>
            <p className="text-white/45 text-xs mt-0.5">{body}</p>
          </Link>
        ))}
      </div>

      <section className="glass rounded-2xl p-5 mb-8">
        <h2 className="text-white font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={15} className="text-[#D4AF37]" />Low stock</h2>
        {lowStock.length === 0 ? <p className="text-white/45 text-sm">Nothing running low.</p> : (
          <ul className="divide-y divide-white/5">
            {lowStock.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <Link href={`/admin/store/products/${p.id}`} className="text-white/80 hover:text-white">{p.name}</Link>
                <span className={`tabular-nums font-semibold ${p.stock <= 0 ? 'text-red-300' : 'text-[#F5D77A]'}`}>{p.stock <= 0 ? 'Sold out' : `${p.stock} left`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-1">CJ Dropshipping — import products</h2>
        <p className="text-white/45 text-sm mb-3">Pulls adult wellness products from CJ Dropshipping and adds them to your catalogue with a 35% markup. Safe to run repeatedly — existing products are updated, not duplicated.</p>
        <CJSyncButton />
      </section>

      <section className="glass rounded-2xl p-5">
        <h2 className="text-white font-semibold mb-1">Sample catalogue</h2>
        <p className="text-white/45 text-sm mb-4">Adds 4 categories and 8 text-only sample products (marked "Sample — edit or delete") so you can see how the store looks. Existing items are left alone.</p>
        <SeedButton />
      </section>
    </div>
  );
}
