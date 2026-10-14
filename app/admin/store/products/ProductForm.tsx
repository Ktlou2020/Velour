'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight, ImagePlus, Loader2, Save, Trash2, X } from 'lucide-react';
import ProtectedImage from '@/components/ProtectedImage';
import { slugify } from '@/lib/store/format';

export interface ProductFormValues {
  name: string; slug: string; description: string; price: string; compareAt: string; categoryId: string;
  stock: string; sku: string; weightGrams: string; tags: string; isActive: boolean; isFeatured: boolean; images: string[];
}

const MAX_IMAGES = 8;

export default function ProductForm({ id, initial, categories }: { id?: string; initial: ProductFormValues; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(!!id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const initialStock = useRef(initial.stock);

  const set = <K extends keyof ProductFormValues>(k: K, val: ProductFormValues[K]) => {
    setSaved(false);
    setV((x) => ({ ...x, [k]: val, ...(k === 'name' && !slugTouched ? { slug: slugify(String(val)) } : {}) }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = [...files].slice(0, MAX_IMAGES - v.images.length);
    if (!list.length) { setError(`Up to ${MAX_IMAGES} photos`); return; }
    setUploading(list.length);
    for (const f of list) {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('purpose', 'product');
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const d = await res.json().catch(() => ({})) as { url?: string; error?: string };
        if (res.ok && d.url) setV((x) => ({ ...x, images: [...x.images, d.url!].slice(0, MAX_IMAGES) }));
        else setError(d.error ?? 'Upload failed');
      } catch { setError('Upload failed'); }
      setUploading((n) => n - 1);
    }
    setSaved(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function move(i: number, d: -1 | 1) {
    setV((x) => {
      const imgs = [...x.images];
      const j = i + d;
      if (j < 0 || j >= imgs.length) return x;
      [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
      return { ...x, images: imgs };
    });
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null); setErrors({});
    try {
      const res = await fetch(id ? `/api/admin/store/products/${id}` : '/api/admin/store/products', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        // stockBase: the stock this form loaded, so the server applies only the change (orders may reserve units meanwhile).
        body: JSON.stringify({ ...v, tags: v.tags.split(',').map((t) => t.trim()).filter(Boolean), ...(id ? { stockBase: Number(initialStock.current) } : {}) }),
      });
      const d = await res.json().catch(() => ({})) as { error?: string; fields?: Record<string, string>; product?: { id: string; slug: string } };
      if (!res.ok) { setErrors(d.fields ?? {}); setError(d.error ?? 'Save failed'); return; }
      if (!id && d.product) { router.replace(`/admin/store/products/${d.product.id}?created=1`); return; }
      if (d.product) {
        const p = d.product as { slug: string; stock?: number };
        setV((x) => ({ ...x, slug: p.slug, ...(typeof p.stock === 'number' ? { stock: String(p.stock) } : {}) }));
        if (typeof p.stock === 'number') initialStock.current = String(p.stock);
      }
      setSaved(true);
      router.refresh();
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!id || !confirm('Delete this product? Past orders keep their records. This cannot be undone.')) return;
    const res = await fetch(`/api/admin/store/products/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin/store/products');
    else setError('Delete failed');
  }

  const input = (k: keyof ProductFormValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <div>
      <label htmlFor={`pf-${k}`} className="block text-sm text-white/75 mb-1.5">{label}</label>
      <input id={`pf-${k}`} value={String(v[k])} onChange={(e) => { if (k === 'slug') setSlugTouched(true); set(k, e.target.value as never); }}
        aria-invalid={!!errors[k]} className={`input-dark w-full ${errors[k] ? '!border-red-400/70' : ''}`} {...props} />
      {errors[k] ? <p className="text-xs text-red-300 mt-1">{errors[k]}</p> : hint ? <p className="text-xs text-white/40 mt-1">{hint}</p> : null}
    </div>
  );

  return (
    <form onSubmit={save} className="p-4 sm:p-8 max-w-4xl">
      <Link href="/admin/store/products" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white mb-3"><ArrowLeft size={14} />Products</Link>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-white text-2xl font-bold font-serif mr-auto">{id ? 'Edit product' : 'New product'}</h1>
        {id && v.isActive && <Link href={`/store/p/${v.slug}`} className="text-xs text-white/50 hover:text-white">View in store ↗</Link>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <section className="glass rounded-2xl p-5 space-y-4">
            {input('name', 'Name', { maxLength: 120, required: true })}
            {input('slug', 'URL slug', { maxLength: 80 }, `/store/p/${v.slug || '…'}`)}
            <div>
              <label htmlFor="pf-description" className="block text-sm text-white/75 mb-1.5">Description</label>
              <textarea id="pf-description" rows={8} maxLength={5000} value={v.description} onChange={(e) => set('description', e.target.value)} className="input-dark w-full" />
              <p className="text-xs text-white/40 mt-1">Plain text. Line breaks are kept; HTML is removed.</p>
            </div>
          </section>

          <section className="glass rounded-2xl p-5">
            <h2 className="text-white font-semibold mb-1">Photos</h2>
            <p className="text-xs text-white/45 mb-4">The first photo is the cover. Tasteful product shots only. JPEG/PNG/WebP up to 10MB — metadata is stripped.</p>
            {errors.images && <p className="text-xs text-red-300 mb-2">{errors.images}</p>}
            <ul className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {v.images.map((src, i) => (
                <li key={src} className="relative group">
                  <div className="aspect-square rounded-xl overflow-hidden border border-white/10">
                    <ProtectedImage src={`${src}?size=thumb`} alt={`Photo ${i + 1}`} className="w-full h-full" />
                  </div>
                  {i === 0 && <span className="absolute top-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">Cover</span>}
                  <div className="flex justify-center gap-1 mt-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier" className="p-1 rounded text-white/50 hover:text-white disabled:opacity-20"><ChevronLeft size={13} /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === v.images.length - 1} aria-label="Move later" className="p-1 rounded text-white/50 hover:text-white disabled:opacity-20"><ChevronRight size={13} /></button>
                    <button type="button" onClick={() => set('images', v.images.filter((x) => x !== src))} aria-label="Remove photo" className="p-1 rounded text-white/50 hover:text-red-300"><X size={13} /></button>
                  </div>
                </li>
              ))}
              {v.images.length < MAX_IMAGES && (
                <li>
                  <label className="aspect-square rounded-xl border border-dashed border-white/20 hover:border-white/40 flex flex-col items-center justify-center gap-1 text-white/50 hover:text-white cursor-pointer text-xs">
                    {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                    {uploading ? 'Uploading…' : 'Add photos'}
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={!!uploading} />
                  </label>
                </li>
              )}
            </ul>
          </section>
        </div>

        <div className="space-y-5">
          <section className="glass rounded-2xl p-5 space-y-4">
            {input('price', 'Price (R, incl. VAT)', { inputMode: 'decimal', placeholder: '1299.00', required: true })}
            {input('compareAt', 'Compare-at price (R)', { inputMode: 'decimal', placeholder: 'Optional' }, 'Shown struck through when higher')}
            {input('stock', 'Stock', { inputMode: 'numeric', required: true })}
            <div>
              <label htmlFor="pf-categoryId" className="block text-sm text-white/75 mb-1.5">Category</label>
              <select id="pf-categoryId" value={v.categoryId} onChange={(e) => set('categoryId', e.target.value)} className="input-dark w-full">
                <option value="" className="bg-[#12121A]">Uncategorised</option>
                {categories.map((c) => <option key={c.id} value={c.id} className="bg-[#12121A]">{c.name}</option>)}
              </select>
              {errors.categoryId && <p className="text-xs text-red-300 mt-1">{errors.categoryId}</p>}
            </div>
            {input('sku', 'SKU', { maxLength: 60, placeholder: 'Optional' })}
            {input('weightGrams', 'Weight (g)', { inputMode: 'numeric', placeholder: 'Optional' })}
            {input('tags', 'Tags', { placeholder: 'rechargeable, silicone' }, 'Comma-separated; used by search')}
          </section>
          <section className="glass rounded-2xl p-5 space-y-3">
            <label className="flex items-center gap-2 text-sm text-white/85 cursor-pointer">
              <input type="checkbox" checked={v.isActive} onChange={(e) => set('isActive', e.target.checked)} className="w-4 h-4 accent-[#DC143C]" />Live in store
            </label>
            <label className="flex items-center gap-2 text-sm text-white/85 cursor-pointer">
              <input type="checkbox" checked={v.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} className="w-4 h-4 accent-[#DC143C]" />Featured
            </label>
          </section>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          {saved && <p role="status" className="text-sm text-emerald-300">Saved</p>}
          <button type="submit" disabled={saving || !!uploading} className="w-full inline-flex items-center justify-center gap-2 bg-[#DC143C] hover:bg-[#FF1744] text-white font-semibold h-11 rounded-xl disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{id ? 'Save changes' : 'Create product'}
          </button>
          {id && (
            <button type="button" onClick={remove} className="w-full inline-flex items-center justify-center gap-2 text-sm text-red-300/80 hover:text-red-300 h-10 rounded-xl hover:bg-red-500/10">
              <Trash2 size={14} />Delete product
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
