'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ProtectedImage from '@/components/ProtectedImage';
import { ImagePlus, Star, Trash2, Loader2 } from 'lucide-react';

interface DemoPhoto { id: string; url: string; thumbnailUrl: string | null; isProfile: boolean }
interface DemoUser {
  id: string;
  username: string;
  profile: { displayName: string | null; city: string | null; isCouple: boolean; gender: string | null } | null;
  photos: DemoPhoto[];
}

const kind = (u: DemoUser) =>
  u.profile?.isCouple ? 'Couple' : u.profile?.gender === 'WOMAN' ? 'Woman' : u.profile?.gender === 'MAN' ? 'Man' : 'Non-binary';

export default function DemoPhotosClient() {
  const [users, setUsers] = useState<DemoUser[] | null>(null);
  const [max, setMax] = useState(9);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/demo/photos', { cache: 'no-store' });
    if (res.ok) {
      const d = await res.json();
      setUsers(d.users);
      setMax(d.max);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function upload(userId: string, files: FileList | null) {
    if (!files?.length) return;
    setError('');
    setBusy(userId);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('userId', userId);
        fd.append('file', file);
        fd.append('rightsConfirmed', rights ? 'yes' : 'no');
        const res = await fetch('/api/admin/demo/photos', { method: 'POST', body: fd });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? 'Upload failed.');
          break;
        }
      }
      await load();
    } finally {
      setBusy(null);
      const el = inputs.current[userId];
      if (el) el.value = '';
    }
  }

  async function makeMain(userId: string, photoId: string) {
    setBusy(userId);
    await fetch('/api/admin/demo/photos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, photoId, action: 'main' }) });
    await load();
    setBusy(null);
  }

  async function remove(userId: string, photoId: string) {
    if (!window.confirm('Delete this photo?')) return;
    setBusy(userId);
    await fetch(`/api/admin/demo/photos?userId=${encodeURIComponent(userId)}&photoId=${encodeURIComponent(photoId)}`, { method: 'DELETE' });
    await load();
    setBusy(null);
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl">
      <h1 className="text-white text-2xl font-bold font-serif">Demo profile photos</h1>
      <p className="text-white/50 text-sm mt-1">
        Add photos to the demo profiles (up to {max} each). Add or remove the profiles themselves on{' '}
        <Link href="/admin/team" className="underline hover:text-white">Admin team</Link>.
      </p>

      <label className="glass rounded-2xl p-4 mt-5 flex gap-3 items-start cursor-pointer border border-[#D4AF37]/25">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-1 accent-[#DC143C]" />
        <span className="text-sm text-white/80 leading-relaxed">
          I confirm I own or have licensed these images for use on an adult dating platform, and that every person pictured is 18+ and has
          consented to their image being used this way. <span className="text-white/50">Required before uploading. Each upload is logged.</span>
        </span>
      </label>

      {error && <p role="alert" className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">{error}</p>}

      {!users ? (
        <p className="text-white/40 text-sm mt-6">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-white/50 text-sm mt-6">No demo profiles yet — add them on <Link href="/admin/team" className="underline">Admin team</Link>.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
          {users.map((u) => (
            <li key={u.id} className="glass rounded-2xl p-4">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{u.profile?.displayName ?? u.username}</p>
                  <p className="text-white/40 text-xs">{kind(u)} · {u.profile?.city ?? '—'} · @{u.username}</p>
                </div>
                <span className="text-white/40 text-xs tabular-nums">{u.photos.length}/{max}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                {u.photos.map((p) => (
                  <div key={p.id} className={`relative aspect-square rounded-lg overflow-hidden border ${p.isProfile ? 'border-[#DC143C]' : 'border-white/10'}`}>
                    <ProtectedImage src={p.thumbnailUrl || p.url} alt="" className="w-full h-full" />
                    <div className="absolute inset-x-0 bottom-0 flex justify-between p-1 bg-gradient-to-t from-black/70">
                      <button
                        onClick={() => makeMain(u.id, p.id)}
                        disabled={p.isProfile || busy === u.id}
                        aria-label={p.isProfile ? 'Main photo' : 'Make main photo'}
                        title={p.isProfile ? 'Main photo' : 'Make main photo'}
                        className={`w-6 h-6 rounded-full flex items-center justify-center ${p.isProfile ? 'bg-[#DC143C] text-white' : 'bg-black/50 text-white/80 hover:text-white'}`}
                      >
                        <Star size={12} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => remove(u.id, p.id)}
                        disabled={busy === u.id}
                        aria-label="Delete photo"
                        className="w-6 h-6 rounded-full bg-black/50 text-white/80 hover:text-red-300 flex items-center justify-center"
                      >
                        <Trash2 size={12} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
                {u.photos.length < max && (
                  <button
                    onClick={() => inputs.current[u.id]?.click()}
                    disabled={!rights || busy === u.id}
                    title={rights ? 'Add photos' : 'Tick the rights confirmation above first'}
                    className="aspect-square rounded-lg border border-dashed border-white/20 text-white/50 hover:text-white hover:border-white/40 flex flex-col items-center justify-center gap-1 text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {busy === u.id ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />}
                    Add
                  </button>
                )}
              </div>
              <input
                ref={(el) => { inputs.current[u.id] = el; }}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => upload(u.id, e.target.files)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
