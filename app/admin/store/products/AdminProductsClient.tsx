'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Boxes, Eye, EyeOff, Plus, Search, Star } from 'lucide-react';
import ProtectedImage from '@/components/ProtectedImage';
import ProductPlaceholder from '@/components/store/ProductPlaceholder';
import { LOW_STOCK_THRESHOLD, SAMPLE_TAG } from '@/lib/store/config';
import { formatRand } from '@/lib/store/format';

interface Row {
  id: string; name: string; slug: string; priceCents: number; compareAtCents: number | null; stock: number; sku: string | null;
  images: string[]; tags: string[]; isActive: boolean; isFeatured: boolean; updatedAt: string;
  category: { id: string; name: string } | null; _count: { orderItems: number };
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Live' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'low', label: 'Low stock' },
  { key: 'out', label: 'Sold out' },
] as const;

export default function AdminProductsClient() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/store/products?filter=${filter}&q=${encodeURIComponent(q)}`).catch(() => null);
    const d = res?.ok ? await res.json() as { products: Row[] } : { products: [] };
    setRows(d.products);
  }, [filter, q]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  async function toggle(r: Row, field: 'isActive' | 'isFeatured') {
    setError(null);
    const res = await fetch(`/api/admin/store/products/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: !r[field] }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})) as { error?: string }; setError(d.error ?? 'Update failed'); }
    load();
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-white text-2xl font-bold font-serif flex items-center gap-2 mr-auto"><Boxes className="text-[#D4AF37]" size={20} />Products</h1>
        <Link href="/admin/store/products/new" className="inline-flex items-center gap-1.5 bg-[#DC143C] hover:bg-[#FF1744] text-white text-sm font-semibold px-4 py-2 rounded-xl"><Plus size={15} />New product</Link>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[12rem]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" aria-hidden="true" />
          <label htmlFor="p-search" className="sr-only">Search products</label>
          <input id="p-search" value={q} onChange={(e) => setQ(e.target.value.slice(0, 80))} placeholder="Search name, SKU or tag" className="input-dark w-full !pl-9 !py-2 text-sm" />
        </div>
        <div className="flex gap-1 flex-wrap" role="tablist" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-2 rounded-xl text-xs font-medium ${filter === f.key ? 'bg-[#DC143C]/20 text-[#FF4D6D]' : 'glass text-white/60 hover:text-white'}`}>{f.label}</button>
          ))}
        </div>
      </div>
      {error && <p role="alert" className="text-red-300 text-sm mb-3">{error}</p>}
      {rows === null ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-white/50 text-sm">No products{q ? ' match' : ' yet'}. <Link href="/admin/store" className="text-[#FF4D6D]">Create the sample catalogue</Link> or add one.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className={`glass rounded-xl p-3 flex items-center gap-3 ${r.isActive ? '' : 'opacity-60'}`}>
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 shrink-0">
                {r.images[0] ? <ProtectedImage src={`${r.images[0]}?size=thumb`} alt="" className="w-full h-full" /> : <ProductPlaceholder name={r.name} category={r.category?.name} size="sm" />}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/admin/store/products/${r.id}`} className="text-white text-sm font-medium hover:text-[#FF85A1] line-clamp-1">{r.name}</Link>
                <p className="text-white/45 text-xs truncate">
                  {r.category?.name ?? 'Uncategorised'}
                  {r.sku && <> · {r.sku}</>}
                  {r.tags.includes(SAMPLE_TAG) && <span className="text-[#F5D77A]"> · Sample</span>}
                  {r._count.orderItems > 0 && <> · {r._count.orderItems} sold</>}
                </p>
                <p className="sm:hidden text-xs mt-0.5 tabular-nums">
                  <span className="text-white">{formatRand(r.priceCents)}</span>{' · '}
                  <span className={r.stock <= 0 ? 'text-red-300' : r.stock <= LOW_STOCK_THRESHOLD ? 'text-[#F5D77A]' : 'text-white/45'}>{r.stock <= 0 ? 'Sold out' : `${r.stock} in stock`}</span>
                </p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-white text-sm tabular-nums">{formatRand(r.priceCents)}</p>
                <p className={`text-xs tabular-nums ${r.stock <= 0 ? 'text-red-300' : r.stock <= LOW_STOCK_THRESHOLD ? 'text-[#F5D77A]' : 'text-white/45'}`}>
                  {r.stock <= 0 ? 'Sold out' : `${r.stock} in stock${r.stock <= LOW_STOCK_THRESHOLD ? ' · low' : ''}`}
                </p>
              </div>
              <button onClick={() => toggle(r, 'isFeatured')} aria-label={r.isFeatured ? 'Unfeature' : 'Feature'} title={r.isFeatured ? 'Featured' : 'Not featured'} className="p-2 rounded-lg hover:bg-white/5">
                <Star size={15} className={r.isFeatured ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-white/30'} />
              </button>
              <button onClick={() => toggle(r, 'isActive')} aria-label={r.isActive ? 'Hide from store' : 'Show in store'} title={r.isActive ? 'Live' : 'Hidden'} className="p-2 rounded-lg hover:bg-white/5">
                {r.isActive ? <Eye size={15} className="text-emerald-300" /> : <EyeOff size={15} className="text-white/40" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
