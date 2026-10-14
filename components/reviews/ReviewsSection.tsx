'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, Flag, MessageSquareQuote, PenLine, Send, Check, EyeOff, Shield, Clock } from 'lucide-react';
import { useToast } from '@/lib/toast-context';
import { CRITERIA, RESPONSE_MAX } from '@/lib/review-criteria';
import { Stars } from './Stars';
import PersonAvatar from './PersonAvatar';
import { useExplicitPref } from './useExplicitPref';
import type { ReviewCardData, ReviewSummary, UserReviewsResponse, ViewerState } from './types';

const PAGE = 6;

const REPORT_REASONS = [
  'Contact details or personal information',
  'Hateful or harassing',
  'Involves a minor or non-consent',
  'Not about a real meeting / fake',
  'Other',
];

/** Big score + the five criteria bars. Only call with count ≥ 1. */
export function ReviewSummaryBlock({ summary, compact = false }: { summary: ReviewSummary; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'mb-6'}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <Star size={compact ? 20 : 26} className="text-[#D4AF37] fill-[#D4AF37] self-center" aria-hidden="true" />
        <span className={`font-serif font-bold text-white ${compact ? 'text-2xl' : 'text-3xl sm:text-4xl'}`}>
          {summary.avg?.toFixed(1)}
        </span>
        <span className="text-white/40" aria-hidden="true">·</span>
        <span className={`text-white/85 font-semibold ${compact ? 'text-sm' : 'text-base sm:text-lg'}`}>
          {summary.count} review{summary.count === 1 ? '' : 's'}
        </span>
        {summary.isNew && (
          <span className="text-[11px] font-semibold text-[#F5D77A] bg-[#D4AF37]/10 border border-[#D4AF37]/25 px-2 py-0.5 rounded-full">
            New — fewer than 3 reviews
          </span>
        )}
      </div>
      <dl className={`grid sm:grid-cols-2 gap-x-8 gap-y-2.5 ${compact ? 'mt-3' : 'mt-5'}`}>
        {CRITERIA.map((c) => {
          const v = summary.criteria[c.key] ?? 0;
          return (
            <div key={c.key} className="flex items-center gap-3 text-sm min-w-0">
              <dt className="text-white/75 flex-1 min-w-0 truncate" title={c.hint}>{c.label}</dt>
              <dd className="flex items-center gap-2.5 w-36 sm:w-32 lg:w-36 flex-shrink-0">
                <span className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
                  <span className="block h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F5D77A]" style={{ width: `${(v / 5) * 100}%` }} />
                </span>
                <span className="text-white/85 font-semibold tabular-nums w-7 text-right">{v.toFixed(1)}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function ExplicitText({ text, show }: { text: string; show: boolean }) {
  const [revealed, setRevealed] = useState(false);
  if (show || revealed) return <p className="text-white/80 text-[15px] leading-relaxed whitespace-pre-line break-words">{text}</p>;
  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      className="relative block w-full text-left rounded-xl overflow-hidden group focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]"
      aria-label="Explicit review — tap to read"
    >
      <p aria-hidden="true" className="text-white/70 text-[15px] leading-relaxed blur-[6px] select-none max-h-[4.5rem] overflow-hidden break-words">{text}</p>
      <span className="absolute inset-0 flex items-center justify-center bg-[#0A0A0F]/40">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-white/10 border border-white/20 px-3 py-1.5 rounded-full group-hover:bg-white/15">
          <EyeOff size={12} aria-hidden="true" /> Explicit review — tap to read
        </span>
      </span>
    </button>
  );
}

export function ReviewCardView({ review, isOwner, showExplicit, revieweeName, onChanged }: {
  review: ReviewCardData;
  isOwner: boolean;
  showExplicit: boolean;
  revieweeName: string;
  onChanged?: (r: ReviewCardData) => void;
}) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.response ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reported, setReported] = useState(false);
  const r = review.reviewer;

  if (review.hidden) {
    return (
      <li className="glass rounded-2xl p-5 border border-white/5">
        <p className="text-white/60 text-sm flex items-center gap-2"><Shield size={14} className="text-white/45" aria-hidden="true" />A review from {r.name} was hidden by moderators.</p>
        <p className="text-white/45 text-xs mt-1">It doesn&apos;t count toward your score.</p>
      </li>
    );
  }

  async function saveResponse() {
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/reviews/${review.id}/response`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response: draft }) });
      const d = await res.json().catch(() => ({})) as { error?: string; response?: string | null; responseAt?: string | null };
      if (!res.ok) { setErr(d.error ?? 'Couldn’t save your response'); return; }
      onChanged?.({ ...review, response: d.response ?? null, responseAt: d.responseAt ?? null });
      setEditing(false);
      showToast(d.response ? 'Response posted' : 'Response removed', 'success');
    } finally { setSaving(false); }
  }

  async function sendReport() {
    if (!reportReason) return;
    const res = await fetch(`/api/reviews/${review.id}/report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reportReason }) }).catch(() => null);
    if (res?.ok) { setReported(true); showToast('Thanks — our moderators will take a look.', 'success'); }
    else showToast('Couldn’t send the report. Please try again.', 'error');
    setReportOpen(false);
  }

  return (
    <li className="glass rounded-2xl p-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        <PersonAvatar name={r.name} photo={r.photo} seed={r.username} />
        <div className="min-w-0 flex-1">
          <p className="text-white font-semibold text-sm truncate">{r.name}{r.age ? <span className="text-white/60 font-normal">, {r.age}</span> : null}{r.city ? <span className="text-white/50 font-normal"> · {r.city}</span> : null}</p>
          <p className="text-white/55 text-xs">Met in {review.metIn}</p>
        </div>
        {!isOwner && !reported && (
          <button type="button" onClick={() => setReportOpen((v) => !v)} className="text-white/35 hover:text-red-300 p-1.5 rounded-lg" aria-label="Report this review" title="Report review">
            <Flag size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Stars value={review.rating} size={13} />
        <span className="text-white/70 text-xs font-semibold">{review.rating.toFixed(1)}</span>
        <span className="sr-only">out of 5</span>
      </div>
      {review.isExplicit ? <ExplicitText text={review.comment} show={showExplicit} /> : (
        <p className="text-white/80 text-[15px] leading-relaxed whitespace-pre-line break-words">{review.comment}</p>
      )}

      {reportOpen && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
          <p className="text-white/80 text-xs font-semibold">Why are you reporting this review?</p>
          <div role="radiogroup" aria-label="Report reason" className="space-y-1.5">
            {REPORT_REASONS.map((reason) => (
              <label key={reason} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border cursor-pointer ${reportReason === reason ? 'border-[#DC143C]/60 bg-[#DC143C]/10 text-white' : 'border-white/10 text-white/70'}`}>
                <input type="radio" name={`report-${review.id}`} value={reason} checked={reportReason === reason} onChange={() => setReportReason(reason)} className="accent-[#DC143C]" />
                {reason}
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setReportOpen(false)} className="glass px-3 py-1.5 rounded-lg text-white/70 text-xs">Cancel</button>
            <button type="button" onClick={sendReport} disabled={!reportReason} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40">Send report</button>
          </div>
        </div>
      )}

      {review.response && !editing && (
        <div className="border-l-2 border-[#DC143C]/50 pl-3 ml-1">
          <p className="text-white/60 text-xs font-semibold mb-0.5 flex items-center gap-1"><MessageSquareQuote size={11} aria-hidden="true" /> Response from {revieweeName}</p>
          <p className="text-white/75 text-sm leading-relaxed whitespace-pre-line break-words">{review.response}</p>
        </div>
      )}

      {isOwner && (editing ? (
        <div>
          <label htmlFor={`resp-${review.id}`} className="sr-only">Your public response</label>
          <textarea
            id={`resp-${review.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, RESPONSE_MAX))}
            rows={3}
            className="input-dark w-full px-3 py-2.5 rounded-xl text-sm resize-none"
            placeholder="Thank them, or add some context — this is public."
          />
          {err && <p className="text-red-300 text-xs mt-1" role="alert">{err}</p>}
          <div className="flex items-center justify-between mt-2 gap-2">
            <span className="text-white/45 text-xs tabular-nums">{draft.length}/{RESPONSE_MAX}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setEditing(false); setDraft(review.response ?? ''); setErr(null); }} className="glass px-3 py-1.5 rounded-lg text-white/70 text-xs">Cancel</button>
              <button type="button" onClick={saveResponse} disabled={saving} className="bg-[#DC143C] hover:bg-[#FF1744] text-white px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50">
                <Send size={11} aria-hidden="true" />{saving ? 'Saving…' : 'Post response'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="self-start text-xs font-semibold text-[#FF4D6D] hover:text-[#FF85A1] inline-flex items-center gap-1">
          <PenLine size={11} aria-hidden="true" />{review.response ? 'Edit your response' : 'Respond publicly'}
        </button>
      ))}
    </li>
  );
}

function ViewerActions({ viewer, username, name, onRequested }: { viewer: ViewerState; username: string; name: string; onRequested: () => void }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  async function ask() {
    setBusy(true);
    try {
      const res = await fetch('/api/reviews/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (res.ok) { showToast(`Asked ${name} for a review`, 'success'); onRequested(); }
      else showToast(d.error ?? 'Couldn’t send the request', 'error');
    } finally { setBusy(false); }
  }
  const items: React.ReactNode[] = [];
  if (viewer.pendingRequestFromThem) {
    items.push(
      <Link key="write" href={`/reviews/write/${viewer.pendingRequestFromThem.id}`} className="inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-4 py-2.5 rounded-xl text-sm font-semibold">
        <PenLine size={14} aria-hidden="true" /> Write a review
      </Link>,
    );
  }
  if (viewer.canRequest) {
    items.push(
      <button key="ask" type="button" onClick={ask} disabled={busy} className="inline-flex items-center justify-center gap-1.5 glass border border-[#D4AF37]/30 hover:border-[#D4AF37]/60 text-[#F5D77A] px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
        <Star size={14} aria-hidden="true" /> Ask @{username} to review you
      </button>,
    );
  } else if (viewer.reason === 'pending') {
    items.push(<span key="pending" className="inline-flex items-center gap-1.5 text-white/60 text-xs"><Clock size={12} aria-hidden="true" /> You asked {name} for a review — waiting for their reply</span>);
  }
  if (viewer.myReview && !viewer.myReview.published) {
    items.push(
      <span key="mine" className="inline-flex items-center gap-1.5 text-white/60 text-xs">
        <Check size={12} className="text-emerald-400" aria-hidden="true" /> Your review appears when {name} reviews you or after 14 days.
        {viewer.myReview.requestId && <Link href={`/reviews/write/${viewer.myReview.requestId}`} className="text-[#FF4D6D] hover:underline font-semibold">Edit</Link>}
      </span>,
    );
  }
  if (!items.length) return null;
  return <div className="flex flex-wrap items-center gap-3 mb-5">{items}</div>;
}

/**
 * Airbnb-style reviews section for a member profile (and the member's own
 * "received reviews" list when `ownerView`).
 */
export default function ReviewsSection({ username, name, ownerView = false, className = '', anchorId = 'reviews', showSummary = true }: {
  username: string;
  /** Hide the score block (e.g. when the page already shows it). */
  showSummary?: boolean;
  /** Element id for #anchors (unique per page). */
  anchorId?: string;
  /** Short name of the reviewed member, e.g. "Thandi". */
  name: string;
  ownerView?: boolean;
  className?: string;
}) {
  const [data, setData] = useState<UserReviewsResponse | null>(null);
  const [reviews, setReviews] = useState<ReviewCardData[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showExplicit, setShowExplicit] = useExplicitPref();

  const load = useCallback(async (p: number) => {
    const res = await fetch(`/api/reviews/user/${encodeURIComponent(username)}?page=${p}&limit=${PAGE}`);
    if (!res.ok) throw new Error(String(res.status));
    return await res.json() as UserReviewsResponse;
  }, [username]);

  const refresh = useCallback(() => {
    load(1).then((d) => { setData(d); setReviews(d.reviews); setPage(1); setFailed(false); })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => { refresh(); }, [refresh]);

  async function more() {
    setLoadingMore(true);
    try {
      const d = await load(page + 1);
      setReviews((prev) => [...prev, ...d.reviews.filter((r) => !prev.some((x) => x.id === r.id))]);
      setPage(d.page);
    } catch { /* keep what we have */ } finally { setLoadingMore(false); }
  }

  const Title = (
    <h2 id={`${anchorId}-heading`} className="font-serif text-lg font-bold text-white mb-4 flex items-center gap-2">
      <Star size={16} className="text-[#D4AF37]" aria-hidden="true" />
      {ownerView ? 'Reviews of you' : 'Reviews'}
    </h2>
  );

  if (loading) {
    return (
      <section id={anchorId} aria-busy="true" className={`glass rounded-2xl p-6 scroll-mt-24 ${className}`}>
        {Title}
        <div className="skeleton h-9 w-48 rounded-lg mb-4" />
        <div className="grid sm:grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-3 rounded" />)}</div>
      </section>
    );
  }
  if (failed || !data) return null;

  const { summary, viewer } = data;
  const anyExplicit = reviews.some((r) => r.isExplicit && !r.hidden);
  const hasMore = page < data.pages;

  return (
    <section id={anchorId} aria-labelledby={`${anchorId}-heading`} className={`glass rounded-2xl p-5 sm:p-6 scroll-mt-24 ${className}`}>
      {Title}
      {!ownerView && <ViewerActions viewer={viewer} username={username} name={name} onRequested={refresh} />}

      {summary.count > 0 ? (showSummary ? <ReviewSummaryBlock summary={summary} /> : null) : (
        <p className="text-white/60 text-sm mb-1">
          {ownerView
            ? 'No public reviews yet. Ask people you’ve met on Hush to review you — it helps others trust you.'
            : `No reviews yet. Reviews come from members who’ve met ${name}.`}
        </p>
      )}

      {anyExplicit && (
        <label className="flex items-center gap-2.5 mb-4 text-xs text-white/70 cursor-pointer select-none w-fit">
          <input type="checkbox" checked={showExplicit} onChange={(e) => setShowExplicit(e.target.checked)} className="peer sr-only" />
          <span aria-hidden="true" className="relative w-8 h-[18px] rounded-full bg-white/15 peer-checked:bg-[#DC143C] transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[#D4AF37] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-[14px] after:h-[14px] after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-[14px]" />
          Always show explicit reviews
        </label>
      )}

      {reviews.length > 0 && (
        <ul className="grid md:grid-cols-2 gap-3">
          {reviews.map((r) => (
            <ReviewCardView
              key={r.id}
              review={r}
              isOwner={viewer.isOwner}
              showExplicit={showExplicit}
              revieweeName={name}
              onChanged={(nr) => setReviews((prev) => prev.map((x) => (x.id === nr.id ? nr : x)))}
            />
          ))}
        </ul>
      )}
      {hasMore && (
        <button type="button" onClick={more} disabled={loadingMore} className="mt-4 w-full sm:w-auto glass border border-white/15 hover:border-white/30 text-white/85 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
          {loadingMore ? 'Loading…' : page === 1 ? `Show all ${data.total} reviews` : 'Show more reviews'}
        </button>
      )}
      <p className="text-white/40 text-[11px] mt-4 flex items-center gap-1.5">
        <Shield size={11} aria-hidden="true" /> Only members who&apos;ve chatted on Hush can review each other. Reviews stay hidden until both have written one, or for 14 days.
      </p>
    </section>
  );
}
