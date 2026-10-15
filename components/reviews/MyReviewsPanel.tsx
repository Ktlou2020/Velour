'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, PenLine, Clock, Hourglass, Send, ChevronRight } from 'lucide-react';
import { useToast } from '@/lib/toast-context';
import { ReviewSummaryBlock } from './ReviewsSection';
import RequestPicker from './RequestPicker';
import PersonAvatar from './PersonAvatar';
import type { ReviewsOverview } from './types';

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' });
}
function daysLeft(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

function Group({ title, icon: Icon, children, id }: { title: string; icon: React.ElementType; children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="scroll-mt-24">
      <h3 className="eyebrow text-white/55 mb-2.5 flex items-center gap-1.5"><Icon size={12} aria-hidden="true" />{title}</h3>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

const rowCls = 'flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 min-w-0';

/**
 * The member's own reviews: score, requests to answer, reviews waiting for
 * publication, requests sent, and "Ask for a review".
 * `compact` (own profile) trims the lists and links to /reviews.
 */
export default function MyReviewsPanel({ initial, compact = false, className = '' }: { initial?: ReviewsOverview | null; compact?: boolean; className?: string }) {
  const { showToast } = useToast();
  const [data, setData] = useState<ReviewsOverview | null>(initial ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch('/api/reviews').then((r) => (r.ok ? r.json() : null)).then((d: ReviewsOverview | null) => d && setData(d)).catch(() => {});
  }, []);
  useEffect(() => { if (!initial) refresh(); }, [initial, refresh]);

  async function decline(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/reviews/requests/${id}/decline`, { method: 'POST' });
      if (res.ok) { setData((d) => d && { ...d, toWrite: d.toWrite.filter((t) => t.id !== id) }); showToast('No problem — we won’t remind you.', 'info'); }
    } finally { setBusy(null); }
  }
  async function cancel(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/reviews/requests?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) { setData((d) => d && { ...d, sent: d.sent.filter((t) => t.id !== id) }); showToast('Request cancelled', 'info'); }
    } finally { setBusy(null); }
  }

  const max = compact ? 3 : 50;
  const sent = (data?.sent ?? []).filter((s) => s.status !== 'COMPLETED');

  return (
    <section id="reviews" aria-labelledby="my-reviews-heading" className={`glass rounded-2xl p-5 sm:p-6 scroll-mt-24 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 id="my-reviews-heading" className="text-white font-semibold flex items-center gap-2">
          <Star size={16} className="text-[#D4AF37]" aria-hidden="true" />
          Your reviews
        </h2>
        {compact && <Link href="/reviews" className="text-xs text-white/60 hover:text-white inline-flex items-center gap-0.5">All reviews <ChevronRight size={12} aria-hidden="true" /></Link>}
      </div>

      {!data ? (
        <div className="space-y-2"><div className="skeleton h-8 w-40 rounded-lg" /><div className="skeleton h-14 rounded-xl" /></div>
      ) : (
        <div className="space-y-6">
          {data.summary.count > 0 ? <ReviewSummaryBlock summary={data.summary} compact /> : (
            <p className="text-white/65 text-sm leading-relaxed">
              No reviews yet. Met someone from Unbound? Ask them for a review — members with reviews rank higher and are easier to trust.
            </p>
          )}

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-[#DC143C]/20"
          >
            <Send size={14} aria-hidden="true" /> Ask someone for a review
          </button>

          {data.toWrite.length > 0 && (
            <Group title="Asked you for a review" icon={PenLine} id="to-write">
              {data.toWrite.slice(0, max).map((t) => (
                <li key={t.id} className={`${rowCls} flex-wrap`}>
                  <PersonAvatar name={t.requester.name} photo={t.requester.photo} seed={t.requester.username} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm"><span className="font-semibold">{t.requester.name}</span> asked you for a review</p>
                    <p className="text-white/50 text-xs">{daysLeft(t.expiresAt)} days left</p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <button type="button" onClick={() => decline(t.id)} disabled={busy === t.id} className="glass px-3 py-2 rounded-lg text-white/70 hover:text-white text-xs">Not now</button>
                    <Link href={`/reviews/write/${t.id}`} className="bg-[#DC143C] hover:bg-[#FF1744] text-white px-3 py-2 rounded-lg text-xs font-semibold">Write review</Link>
                  </div>
                </li>
              ))}
            </Group>
          )}

          {(data.awaiting.length > 0 || data.drafts.length > 0) && (
            <Group title="Waiting to be published" icon={Hourglass} id="awaiting">
              {data.awaiting.slice(0, max).map((a) => (
                <li key={a.id} className={`${rowCls} flex-wrap`}>
                  <PersonAvatar name={a.reviewer.name} photo={a.reviewer.photo} seed={a.reviewer.username} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm"><span className="font-semibold">{a.reviewer.name}</span> left you a review</p>
                    <p className="text-white/55 text-xs leading-relaxed">It&apos;ll appear when you review them back or on {shortDate(a.publishesOn)}.</p>
                  </div>
                  {a.writeRequestId && (
                    <Link href={`/reviews/write/${a.writeRequestId}`} className="ml-auto bg-[#DC143C] hover:bg-[#FF1744] text-white px-3 py-2 rounded-lg text-xs font-semibold">Write yours</Link>
                  )}
                </li>
              ))}
              {data.drafts.slice(0, max).map((d) => (
                <li key={d.id} className={rowCls}>
                  <PersonAvatar name={d.reviewee.name} photo={d.reviewee.photo} seed={d.reviewee.username} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm">Your review of <span className="font-semibold">{d.reviewee.name}</span></p>
                    <p className="text-white/55 text-xs">Hidden until they review you or {shortDate(d.publishesOn)}</p>
                  </div>
                  {d.requestId && <Link href={`/reviews/write/${d.requestId}`} className="glass px-3 py-2 rounded-lg text-white/80 hover:text-white text-xs font-semibold flex-shrink-0">Edit</Link>}
                </li>
              ))}
            </Group>
          )}

          {sent.length > 0 && (
            <Group title="Requests you sent" icon={Clock} id="sent">
              {sent.slice(0, max).map((s) => (
                <li key={s.id} className={rowCls}>
                  <PersonAvatar name={s.reviewer.name} photo={s.reviewer.photo} seed={s.reviewer.username} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm truncate">{s.reviewer.name}</p>
                    <p className={`text-xs ${s.status === 'EXPIRED' ? 'text-white/40' : 'text-white/55'}`}>
                      {s.status === 'EXPIRED' ? `Expired ${shortDate(s.expiresAt)}` : `Waiting for a reply · asked ${shortDate(s.createdAt)}`}
                    </p>
                  </div>
                  {s.status === 'PENDING' && (
                    <button type="button" onClick={() => cancel(s.id)} disabled={busy === s.id} className="text-white/55 hover:text-white text-xs px-2 py-1.5 flex-shrink-0">Cancel</button>
                  )}
                </li>
              ))}
            </Group>
          )}

          {!compact && data.written.length > 0 && (
            <Group title="Reviews you've written" icon={Star}>
              {data.written.map((w) => (
                <li key={w.id} className={rowCls}>
                  <PersonAvatar name={w.reviewee.name} photo={w.reviewee.photo} seed={w.reviewee.username} size={36} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/members/${w.reviewee.username}#reviews`} className="text-white text-sm font-semibold hover:underline truncate block">{w.reviewee.name}</Link>
                    <p className="text-white/50 text-xs">Published {shortDate(w.publishedAt)}</p>
                  </div>
                  <span className="text-[#F5D77A] text-xs font-bold inline-flex items-center gap-0.5"><Star size={11} className="fill-[#D4AF37] text-[#D4AF37]" aria-hidden="true" />{w.rating.toFixed(1)}</span>
                </li>
              ))}
            </Group>
          )}
        </div>
      )}
      <RequestPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSent={refresh} />
    </section>
  );
}
