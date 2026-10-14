'use client';

import { useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { SORTS } from '@/lib/store/config';

interface Props {
  action: string;
  categories?: { slug: string; name: string }[];
  values: { q?: string; category?: string; min?: number; max?: number; inStock?: boolean; sort?: string };
  total: number;
}

/** Plain GET form (works without JavaScript); sort and stock auto-apply. */
export default function FilterBar({ action, categories, values, total }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const hasFilters = values.min !== undefined || values.max !== undefined || values.inStock || (!!categories && !!values.category);
  const [open, setOpen] = useState(hasFilters);
  const submit = () => formRef.current?.requestSubmit();

  return (
    <form ref={formRef} method="get" action={action} className="mb-5" aria-label="Filter and sort products">
      {values.q && <input type="hidden" name="q" value={values.q} />}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-white/55 text-sm mr-auto" aria-live="polite">
          {total} product{total === 1 ? '' : 's'}{values.q ? <> for “<span className="text-white">{values.q}</span>”</> : null}
        </p>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="store-filters"
          className={`inline-flex items-center gap-1.5 text-sm px-3 h-9 rounded-xl border ${open || hasFilters ? 'border-[#DC143C]/40 text-white bg-[#DC143C]/10' : 'border-white/10 text-white/70 hover:text-white'}`}>
          <SlidersHorizontal size={14} aria-hidden="true" />Filters
        </button>
        <label htmlFor="store-sort" className="sr-only">Sort by</label>
        <select id="store-sort" name="sort" defaultValue={values.sort ?? 'featured'} onChange={submit}
          className="bg-white/5 border border-white/10 rounded-xl h-9 px-3 text-sm text-white focus:border-[#DC143C] focus:outline-none">
          {SORTS.map((s) => <option key={s.key} value={s.key} className="bg-[#12121A]">{s.label}</option>)}
        </select>
      </div>
      <div id="store-filters" hidden={!open} className="mt-3 glass rounded-2xl p-4">
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 items-end">
          {categories && (
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="f-category" className="block text-xs text-white/55 mb-1">Category</label>
              <select id="f-category" name="category" defaultValue={values.category ?? ''} className="input-dark w-full !py-2 text-sm">
                <option value="" className="bg-[#12121A]">All categories</option>
                {categories.map((c) => <option key={c.slug} value={c.slug} className="bg-[#12121A]">{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="f-min" className="block text-xs text-white/55 mb-1">Min price (R)</label>
            <input id="f-min" name="min" inputMode="numeric" pattern="[0-9]*" defaultValue={values.min !== undefined ? values.min / 100 : ''} placeholder="0" className="input-dark w-full !py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="f-max" className="block text-xs text-white/55 mb-1">Max price (R)</label>
            <input id="f-max" name="max" inputMode="numeric" pattern="[0-9]*" defaultValue={values.max !== undefined ? values.max / 100 : ''} placeholder="Any" className="input-dark w-full !py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-white/80 h-10 cursor-pointer">
            <input type="checkbox" name="stock" value="1" defaultChecked={values.inStock} onChange={submit} className="w-4 h-4 accent-[#DC143C]" />
            In stock only
          </label>
        </div>
        <div className="flex gap-3 mt-4">
          <button type="submit" className="bg-[#DC143C] hover:bg-[#FF1744] text-white text-sm font-semibold px-4 h-9 rounded-xl">Apply</button>
          {hasFilters && <a href={values.q ? `${action}?q=${encodeURIComponent(values.q)}` : action} className="text-sm text-white/60 hover:text-white h-9 inline-flex items-center px-2">Clear filters</a>}
        </div>
      </div>
    </form>
  );
}
