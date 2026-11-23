'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ImageUp, CheckCircle, Check, Trash2, ShieldCheck } from 'lucide-react';
import ProtectedImage from '@/components/ProtectedImage';

type QueuePhoto = {
  id: string; url: string; isProfile: boolean; createdAt: string;
  user: { id: string; username: string; isVerified: boolean; profile: { displayName: string | null } | null };
};

const fmt = (d: string) => new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' });

/** New public photos waiting for an admin: approve (one or all shown) or remove with a reason. */
export default function PhotoReviewClient() {
  const [photos, setPhotos] = useState<QueuePhoto[] | null>(null);
  const [total, setTotal] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const [removing, setRemoving] = useState<QueuePhoto | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetch('/api/admin/photos').then((r) => r.json()).then((d) => {
      setPhotos(d.photos ?? []); setTotal(d.total ?? 0); setReasons(d.reasons ?? []);
    }).catch(() => setPhotos([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function approve(ids: string[]) {
    setBusy(true);
    try {
      await fetch('/api/admin/photos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', photoIds: ids }) });
      setPhotos((p) => (p ?? []).filter((x) => !ids.includes(x.id)));
      setTotal((t) => Math.max(0, t - ids.length));
    } finally { setBusy(false); }
  }

  async function confirmRemove() {
    if (!removing || !reason) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/photos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove', photoId: removing.id, reason }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Couldn’t remove the photo'); return; }
      setPhotos((p) => (p ?? []).filter((x) => x.id !== removing.id));
      setTotal((t) => Math.max(0, t - 1));
      setRemoving(null);
    } finally { setBusy(false); }
  }

  return (
    <div className="p-6 sm:p-8 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold font-serif flex items-center gap-2"><ImageUp className="text-[#FF4D6D]" size={20} /> Photo review</h1>
          <p className="text-white/50 text-sm mt-1 max-w-2xl">New public photos stay visible while they wait here. Remove anything with nudity, contact details, other people&apos;s faces or that isn&apos;t the member — they&apos;re told why.</p>
        </div>
        {photos && photos.length > 0 && (
          <button onClick={() => approve(photos.map((p) => p.id))} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50">
            Approve all {photos.length} shown
          </button>
        )}
      </div>
      {photos === null ? <p className="text-white/50 text-sm">Loading…</p> : photos.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center"><CheckCircle className="text-emerald-400 mx-auto mb-2" size={28} /><p className="text-white/55">No photos waiting for review</p></div>
      ) : (
        <>
          <p className="text-white/55 text-sm mb-3">{total} waiting{total > photos.length ? ` · showing the oldest ${photos.length}` : ''}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((p) => (
              <div key={p.id} className="glass rounded-2xl overflow-hidden">
                <a href={p.url} target="_blank" rel="noreferrer" className="block aspect-[3/4] relative">
                  <ProtectedImage src={p.url + '?size=medium'} alt="" className="w-full h-full" />
                  {p.isProfile && <span className="absolute top-2 left-2 text-[10px] font-semibold bg-[#DC143C]/85 text-white px-1.5 py-0.5 rounded">Profile photo</span>}
                </a>
                <div className="p-3">
                  <Link href={`/admin/users/${p.user.id}`} className="text-white text-sm font-medium hover:underline truncate block">
                    {p.user.profile?.displayName || p.user.username} {p.user.isVerified && <ShieldCheck size={12} className="inline text-emerald-400" />}
                  </Link>
                  <p className="text-white/45 text-xs">@{p.user.username} · {fmt(p.createdAt)}</p>
                  <div className="flex gap-2 mt-2.5">
                    <button onClick={() => approve([p.id])} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-1 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold py-2 rounded-lg disabled:opacity-50"><Check size={13} /> Approve</button>
                    <button onClick={() => { setRemoving(p); setReason(''); setError(''); }} disabled={busy} className="flex-1 inline-flex items-center justify-center gap-1 glass text-red-300 hover:bg-red-500/10 text-xs font-semibold py-2 rounded-lg"><Trash2 size={13} /> Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {removing && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="remove-title">
          <div className="glass-dark rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h2 id="remove-title" className="text-white font-semibold mb-1">Remove this photo?</h2>
            <p className="text-white/55 text-xs mb-4">It&apos;s deleted and {removing.user.profile?.displayName || removing.user.username} is told why{removing.isProfile ? ' — it’s their profile photo, so they’ll be asked to add a new one' : ''}.</p>
            <div className="space-y-1.5">
              {reasons.map((r) => (
                <label key={r} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${reason === r ? 'border-red-400/60 bg-red-500/10 text-white' : 'border-white/10 text-white/75'}`}>
                  <input type="radio" name="remove-reason" checked={reason === r} onChange={() => setReason(r)} className="accent-[#DC143C]" /> {r}
                </label>
              ))}
            </div>
            {error && <p role="alert" className="text-red-300 text-xs mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setRemoving(null)} className="glass text-white/70 px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button onClick={confirmRemove} disabled={busy || !reason} className="bg-[#DC143C] hover:bg-[#FF1744] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">{busy ? 'Removing…' : 'Remove photo'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
