'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, EyeOff, Eye, CheckCircle, Flag, Flame } from 'lucide-react';

interface AdminReview {
  id: string;
  comment: string;
  response: string | null;
  isExplicit: boolean;
  isHidden: boolean;
  hiddenReason: string | null;
  reportCount: number;
  publishedAt: string | null;
  createdAt: string;
  respectful: number; communication: number; authenticity: number; reliability: number; overall: number;
  reviewer: { id: string; username: string };
  reviewee: { id: string; username: string };
  reports: { reason: string; details: string | null; at: string; open: boolean }[];
}

const FILTERS = [
  { key: 'reported', label: 'Reported' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'recent', label: 'Recent' },
] as const;

export default function AdminReviewsClient() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('reported');
  const [rows, setRows] = useState<AdminReview[] | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    const res = await fetch(`/api/admin/reviews?filter=${filter}`).catch(() => null);
    const d = res?.ok ? await res.json() as { reviews: AdminReview[]; total: number } : { reviews: [], total: 0 };
    setRows(d.reviews); setTotal(d.total);
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  async function act(r: AdminReview, action: 'hide' | 'unhide' | 'dismiss') {
    setError(null);
    if (action === 'hide' && !reasons[r.id]?.trim()) { setError('Add a reason before hiding.'); return; }
    setBusy(r.id + action);
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: r.id, action, reason: reasons[r.id] }),
      });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setError(d.error ?? 'Action failed'); return; }
      await load();
    } finally { setBusy(null); }
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <h1 className="text-white text-2xl font-bold font-serif flex items-center gap-2">
        <Star className="text-[#D4AF37]" size={20} /> Review moderation
      </h1>
      <p className="text-white/40 text-sm mt-1 mb-5">Hidden reviews don&apos;t count toward scores and aren&apos;t shown to members.</p>

      <div className="flex gap-2 mb-5" role="tablist" aria-label="Filter reviews">
        {FILTERS.map((f) => (
          <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${filter === f.key ? 'bg-[#DC143C]/20 text-[#FF4D6D]' : 'glass text-white/60 hover:text-white'}`}>
            {f.label}
          </button>
        ))}
        <span className="ml-auto self-center text-white/40 text-xs hidden sm:inline">{rows ? `${total} review${total === 1 ? '' : 's'}` : ''}</span>
      </div>
      {error && <p role="alert" className="text-red-300 text-sm mb-3">{error}</p>}

      {rows === null ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <CheckCircle className="text-emerald-400 mx-auto mb-2" size={28} />
          <p className="text-white/50 text-sm">Nothing here</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const avg = (r.respectful + r.communication + r.authenticity + r.reliability + r.overall) / 5;
            return (
              <li key={r.id} className={`glass rounded-2xl p-5 border ${r.isHidden ? 'border-white/10 opacity-80' : r.reportCount > 0 ? 'border-orange-500/25' : 'border-white/5'}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                  <Link href={`/members/${r.reviewer.username}`} className="text-[#FF4D6D] font-semibold">@{r.reviewer.username}</Link>
                  <span className="text-white/40">reviewed</span>
                  <Link href={`/members/${r.reviewee.username}`} className="text-white font-semibold">@{r.reviewee.username}</Link>
                  <span className="text-[#F5D77A] font-bold inline-flex items-center gap-0.5"><Star size={10} className="fill-[#D4AF37] text-[#D4AF37]" />{avg.toFixed(1)}</span>
                  {r.isExplicit && <span className="inline-flex items-center gap-1 bg-[#DC143C]/15 text-[#FF85A1] px-2 py-0.5 rounded-full font-semibold"><Flame size={10} />Explicit</span>}
                  {r.reportCount > 0 && <span className="inline-flex items-center gap-1 bg-orange-500/15 text-orange-300 px-2 py-0.5 rounded-full font-semibold"><Flag size={10} />{r.reportCount} report{r.reportCount === 1 ? '' : 's'}</span>}
                  {r.isHidden && <span className="bg-white/10 text-white/70 px-2 py-0.5 rounded-full font-semibold">Hidden</span>}
                  {!r.publishedAt && <span className="bg-white/5 text-white/50 px-2 py-0.5 rounded-full">Not yet published</span>}
                  <span className="text-white/30 ml-auto">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-white/85 text-sm leading-relaxed whitespace-pre-line break-words">{r.comment}</p>
                {r.response && <p className="text-white/55 text-xs mt-2 border-l-2 border-white/15 pl-2 break-words">Response: {r.response}</p>}
                {r.isHidden && r.hiddenReason && <p className="text-white/50 text-xs mt-2">Hidden because: {r.hiddenReason}</p>}
                {r.reports.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {r.reports.map((rep, i) => (
                      <li key={i} className="text-xs text-orange-200/80">
                        <Flag size={10} className="inline -mt-0.5 mr-1" />{rep.reason}{rep.details ? ` — ${rep.details}` : ''}
                        <span className="text-white/30"> · {new Date(rep.at).toLocaleDateString()}{rep.open ? ' · open' : ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {r.isHidden ? (
                    <button onClick={() => act(r, 'unhide')} disabled={!!busy} className="inline-flex items-center gap-1.5 text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 px-3 py-1.5 rounded-lg">
                      <Eye size={12} /> Unhide
                    </button>
                  ) : (
                    <>
                      <label className="sr-only" htmlFor={`reason-${r.id}`}>Reason for hiding</label>
                      <input id={`reason-${r.id}`} value={reasons[r.id] ?? ''} onChange={(e) => setReasons((x) => ({ ...x, [r.id]: e.target.value.slice(0, 200) }))}
                        placeholder="Reason (shown in the log)" className="input-dark px-3 py-1.5 rounded-lg text-xs flex-1 min-w-[10rem]" />
                      <button onClick={() => act(r, 'hide')} disabled={!!busy} className="inline-flex items-center gap-1.5 text-xs bg-red-500/20 text-red-300 hover:bg-red-500/30 px-3 py-1.5 rounded-lg">
                        <EyeOff size={12} /> Hide
                      </button>
                      {r.reportCount > 0 && (
                        <button onClick={() => act(r, 'dismiss')} disabled={!!busy} className="inline-flex items-center gap-1.5 text-xs glass text-white/70 hover:text-white px-3 py-1.5 rounded-lg">
                          <CheckCircle size={12} /> Keep &amp; clear reports
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
