'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, CheckCircle, Check, X } from 'lucide-react';
import ProtectedImage from '@/components/ProtectedImage';
import { sizedMediaUrl } from '@/lib/media';

type Req = {
  id: string; photoUrl: string; pose: string | null; createdAt: string;
  user: {
    id: string; username: string; email: string; createdAt: string;
    profile: { displayName: string | null; dateOfBirth: string | null; city: string | null; isCouple: boolean } | null;
    photos: { id: string; url: string; isProfile: boolean }[];
  };
};

const REJECT_NOTES = [
  'The pose doesn’t match the one we asked for',
  'Your face isn’t clearly visible',
  'The selfie doesn’t match your profile photos',
  'Please use a live selfie, not an existing photo',
];

const ageOf = (dob: string | null | undefined) => dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : null;
const fmt = (d: string) => new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' });

/** Pending verification selfies, shown next to the pose asked for and the member's public photos. */
export default function VerificationClient() {
  const [requests, setRequests] = useState<Req[] | null>(null);
  const [rejecting, setRejecting] = useState<Req | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    fetch('/api/admin/verification').then((r) => r.json()).then((d) => setRequests(d.requests ?? [])).catch(() => setRequests([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function decide(r: Req, action: 'approve' | 'reject', note?: string) {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/verification', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: r.id, action, notes: note }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Something went wrong'); return; }
      setRequests((list) => (list ?? []).filter((x) => x.id !== r.id));
      setRejecting(null);
    } finally { setBusy(false); }
  }

  return (
    <div className="p-6 sm:p-8 max-w-6xl">
      <h1 className="text-white text-2xl font-bold font-serif flex items-center gap-2"><BadgeCheck className="text-[#FF4D6D]" size={20} /> Verification</h1>
      <p className="text-white/50 text-sm mt-1 mb-6 max-w-2xl">Approve when the selfie shows the requested pose and the same person as the profile photos. Selfies are private — only admins see them.</p>

      {error && <p role="alert" className="text-red-300 text-sm mb-4">{error}</p>}
      {requests === null ? (
        <p className="text-white/40 text-sm">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-white/60"><CheckCircle className="mx-auto mb-2 text-emerald-400" /> No verification requests waiting.</div>
      ) : (
        <div className="space-y-5">
          {requests.map((r) => {
            const name = r.user.profile?.displayName || r.user.username;
            return (
              <div key={r.id} className="glass rounded-2xl p-5" data-request={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <Link href={`/admin/users/${r.user.id}`} className="text-white font-semibold hover:underline">{name}</Link>
                    <span className="text-white/40 text-sm"> @{r.user.username}{ageOf(r.user.profile?.dateOfBirth) ? ` · ${ageOf(r.user.profile?.dateOfBirth)}` : ''}{r.user.profile?.city ? ` · ${r.user.profile.city}` : ''}{r.user.profile?.isCouple ? ' · Couple' : ''}</span>
                    <p className="text-white/40 text-xs mt-0.5">Submitted {fmt(r.createdAt)} · joined {fmt(r.user.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => { setRejecting(r); setNotes(''); setError(''); }} className="glass text-white/80 px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50"><X size={15} /> Reject</button>
                    <button type="button" disabled={busy} onClick={() => decide(r, 'approve')} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"><Check size={15} /> Approve</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wide mb-1.5">Selfie</p>
                    <div className="rounded-xl overflow-hidden bg-black/40 aspect-[3/4] relative">
                      <ProtectedImage src={sizedMediaUrl(r.photoUrl, 'medium')} alt={`Verification selfie of ${name}`} className="w-full h-full" />
                    </div>
                    <p className="text-white/80 text-sm mt-2"><span className="text-white/45">Pose asked: </span>{r.pose ?? 'No pose (older request)'}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-xs uppercase tracking-wide mb-1.5">Profile photos</p>
                    {r.user.photos.length === 0 ? (
                      <p className="text-white/40 text-sm">No public photos.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {r.user.photos.map((p) => (
                          <div key={p.id} className="rounded-xl overflow-hidden bg-black/40 aspect-[3/4] relative">
                            <ProtectedImage src={sizedMediaUrl(p.url, 'medium')} alt={p.isProfile ? 'Main profile photo' : 'Profile photo'} className="w-full h-full" />
                            {p.isProfile && <span className="absolute top-1.5 left-1.5 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">Main</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="reject-title">
          <div className="glass-dark rounded-2xl p-6 w-full max-w-md border border-white/10">
            <h2 id="reject-title" className="text-white font-semibold mb-1">Reject {rejecting.user.profile?.displayName || rejecting.user.username}?</h2>
            <p className="text-white/55 text-sm mb-3">They&apos;ll see this note and can try again with a new pose.</p>
            <div className="space-y-1.5 mb-3">
              {REJECT_NOTES.map((n) => (
                <button key={n} type="button" onClick={() => setNotes(n)} className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${notes === n ? 'border-red-400/60 bg-red-500/10 text-white' : 'border-white/10 text-white/75 hover:border-white/20'}`}>{n}</button>
              ))}
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 500))} rows={2} aria-label="Note to member" className="input-dark w-full px-3 py-2 rounded-xl text-sm resize-none" />
            {error && <p role="alert" className="text-red-300 text-xs mt-2">{error}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setRejecting(null)} className="glass text-white/70 px-4 py-2 rounded-lg text-sm">Cancel</button>
              <button type="button" disabled={busy || !notes.trim()} onClick={() => decide(rejecting, 'reject', notes)} className="bg-[#DC143C] hover:bg-[#FF1744] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
