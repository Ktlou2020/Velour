'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';

interface Cat { id: string; name: string; slug: string; description: string | null; order: number; productCount: number }

export default function AdminCategoriesClient() {
  const [rows, setRows] = useState<Cat[] | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', slug: '', description: '' });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/store/categories').catch(() => null);
    setRows(res?.ok ? (await res.json() as { categories: Cat[] }).categories : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function call(url: string, method: string, body?: unknown) {
    setError(null);
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const d = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) { setError(d.error ?? 'Failed'); return false; }
    await load();
    return true;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await call('/api/admin/store/categories', 'POST', { name, description: desc })) { setName(''); setDesc(''); }
  }

  async function move(i: number, d: -1 | 1) {
    if (!rows) return;
    const ids = rows.map((r) => r.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await call('/api/admin/store/categories', 'POST', { reorder: ids });
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <h1 className="text-white text-2xl font-bold font-serif flex items-center gap-2 mb-1"><Tags className="text-[#D4AF37]" size={20} />Categories</h1>
      <p className="text-white/40 text-sm mb-6">Shown as chips on the store, in this order. Deleting a category leaves its products uncategorised.</p>

      <form onSubmit={add} className="glass rounded-2xl p-4 mb-6 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] items-end">
        <div>
          <label htmlFor="c-name" className="block text-xs text-white/55 mb-1">Name</label>
          <input id="c-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required className="input-dark w-full !py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="c-desc" className="block text-xs text-white/55 mb-1">Description (optional)</label>
          <input id="c-desc" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={300} className="input-dark w-full !py-2 text-sm" />
        </div>
        <button type="submit" className="inline-flex items-center justify-center gap-1.5 bg-[#DC143C] hover:bg-[#FF1744] text-white text-sm font-semibold px-4 h-10 rounded-xl"><Plus size={15} />Add</button>
      </form>
      {error && <p role="alert" className="text-red-300 text-sm mb-3">{error}</p>}

      {rows === null ? <div className="skeleton h-40 rounded-2xl" /> : rows.length === 0 ? (
        <p className="glass rounded-2xl p-6 text-center text-white/50 text-sm">No categories yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((c, i) => (
            <li key={c.id} className="glass rounded-xl p-3">
              {editing === c.id ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <input aria-label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="input-dark !py-2 text-sm" />
                  <input aria-label="Slug" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} className="input-dark !py-2 text-sm" />
                  <input aria-label="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="input-dark !py-2 text-sm" />
                  <div className="sm:col-span-3 flex gap-2">
                    <button type="button" onClick={async () => { if (await call(`/api/admin/store/categories/${c.id}`, 'PATCH', draft)) setEditing(null); }} className="inline-flex items-center gap-1 text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-lg"><Check size={12} />Save</button>
                    <button type="button" onClick={() => setEditing(null)} className="inline-flex items-center gap-1 text-xs glass text-white/70 px-3 py-1.5 rounded-lg"><X size={12} />Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${c.name} up`} className="text-white/40 hover:text-white disabled:opacity-20"><ArrowUp size={13} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move ${c.name} down`} className="text-white/40 hover:text-white disabled:opacity-20"><ArrowDown size={13} /></button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{c.name} <span className="text-white/35 text-xs font-normal">/{c.slug}</span></p>
                    <p className="text-white/45 text-xs truncate">{c.productCount} product{c.productCount === 1 ? '' : 's'}{c.description ? ` · ${c.description}` : ''}</p>
                  </div>
                  <button onClick={() => { setEditing(c.id); setDraft({ name: c.name, slug: c.slug, description: c.description ?? '' }); }} aria-label={`Edit ${c.name}`} className="p-2 text-white/50 hover:text-white rounded-lg hover:bg-white/5"><Pencil size={14} /></button>
                  <button onClick={() => { if (confirm(`Delete “${c.name}”? Its products become uncategorised.`)) call(`/api/admin/store/categories/${c.id}`, 'DELETE'); }} aria-label={`Delete ${c.name}`} className="p-2 text-white/50 hover:text-red-300 rounded-lg hover:bg-red-500/10"><Trash2 size={14} /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
