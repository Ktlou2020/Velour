'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Star, ShieldCheck, Check, Info, Flame } from 'lucide-react';
import { CRITERIA, COMMENT_MAX, COMMENT_MIN, BLIND_DAYS, type CriterionKey, type Ratings } from '@/lib/review-criteria';
import PersonAvatar from './PersonAvatar';
import type { ReviewPerson } from './types';

const WORDS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

function StarInput({ name, label, hint, value, onChange, invalid }: {
  name: string; label: string; hint: string; value: number; onChange: (v: number) => void; invalid: boolean;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset className={`rounded-2xl border p-4 transition-colors ${invalid ? 'border-red-400/50 bg-red-500/[0.04]' : 'border-white/10 bg-white/[0.02]'}`}>
      <legend className="sr-only">{label} — {hint}</legend>
      <div className="flex items-start justify-between gap-3 mb-2.5" aria-hidden="true">
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm">{label}</p>
          <p className="text-white/55 text-xs">{hint}</p>
        </div>
        <span className={`text-xs font-semibold flex-shrink-0 mt-0.5 ${shown ? 'text-[#F5D77A]' : 'text-white/35'}`}>{shown ? WORDS[shown] : 'Tap to rate'}</span>
      </div>
      <div className="flex gap-1.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            onMouseEnter={() => setHover(n)}
            className="cursor-pointer rounded-lg p-1 -m-0.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#D4AF37]"
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
              aria-label={`${label}: ${n} star${n === 1 ? '' : 's'} — ${WORDS[n]}`}
              required
            />
            <Star size={34} aria-hidden="true" className={`transition-colors ${n <= shown ? 'text-[#D4AF37] fill-[#D4AF37]' : 'text-white/25'}`} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export interface ReviewFormProps {
  requestId: string;
  reviewee: ReviewPerson;
  /** Editing an unpublished review. */
  existing?: { id: string; ratings: Ratings; comment: string; isExplicit: boolean } | null;
  /** The reviewer may also ask the reviewee for a review in the same step. */
  canAskBack: boolean;
}

export default function ReviewForm({ requestId, reviewee, existing, canAskBack }: ReviewFormProps) {
  const [ratings, setRatings] = useState<Partial<Ratings>>(existing?.ratings ?? {});
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [isExplicit, setIsExplicit] = useState(existing?.isExplicit ?? false);
  const [askBack, setAskBack] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ published: boolean; askBack?: { ok: boolean; message: string } } | null>(null);

  const name = reviewee.name;
  const len = comment.trim().length;
  const missing = CRITERIA.filter((c) => !ratings[c.key]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    setError(null);
    if (missing.length) { setError(`Please rate ${missing.map((m) => m.label.toLowerCase()).join(', ')}.`); return; }
    if (len < COMMENT_MIN) { setError(`Please write at least ${COMMENT_MIN} characters about your experience.`); return; }
    setSubmitting(true);
    try {
      const res = await fetch(existing ? `/api/reviews/${existing.id}` : '/api/reviews', {
        method: existing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, ratings, comment, isExplicit, askBack: canAskBack && askBack }),
      });
      const d = await res.json().catch(() => ({})) as { error?: string; review?: { published: boolean }; askBack?: { ok: boolean; message: string } };
      if (!res.ok) { setError(d.error ?? 'Something went wrong. Please try again.'); return; }
      setDone({ published: !!d.review?.published, askBack: d.askBack });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('You seem to be offline. Please try again.');
    } finally { setSubmitting(false); }
  }

  if (done) {
    return (
      <div className="glass rounded-3xl p-6 sm:p-8 text-center" role="status">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center mx-auto mb-4">
          <Check size={28} className="text-emerald-300" aria-hidden="true" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-white mb-2">{existing ? 'Changes saved' : 'Thanks for your review'}</h2>
        {done.published ? (
          <p className="text-white/70 text-sm leading-relaxed max-w-sm mx-auto">You and {name} have both reviewed each other, so both reviews are now public.</p>
        ) : (
          <p className="text-white/70 text-sm leading-relaxed max-w-sm mx-auto">
            Reviews are double-blind: yours stays hidden until {name} reviews you too, or for {BLIND_DAYS} days. That way neither of you is influenced by the other.
            {!existing && ' You can edit it until then.'}
          </p>
        )}
        {done.askBack && (
          <p className={`text-sm mt-4 ${done.askBack.ok ? 'text-emerald-300' : 'text-white/60'}`}>{done.askBack.message}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7">
          <Link href="/reviews" className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-6 py-3 rounded-xl font-semibold text-sm">Your reviews</Link>
          <Link href="/messages" className="glass border border-white/15 hover:border-white/30 text-white/85 px-6 py-3 rounded-xl font-medium text-sm">Back to messages</Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="flex items-center gap-3">
        <PersonAvatar name={name} photo={reviewee.photo} seed={reviewee.username} size={52} />
        <div className="min-w-0">
          <p className="eyebrow text-[#FF4D6D]">{existing ? 'Edit your review' : 'Write a review'}</p>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white leading-tight">How was meeting {name}?</h1>
        </div>
      </div>

      <div className="space-y-3">
        {CRITERIA.map((c) => (
          <StarInput
            key={c.key}
            name={`rating-${c.key}`}
            label={c.label}
            hint={c.hint}
            value={ratings[c.key] ?? 0}
            onChange={(v) => setRatings((r) => ({ ...r, [c.key as CriterionKey]: v }))}
            invalid={tried && !ratings[c.key]}
          />
        ))}
      </div>

      <div>
        <label htmlFor="review-comment" className="text-white font-semibold text-sm block mb-1">Tell others about your experience</label>
        <p id="review-guidelines" className="text-white/60 text-xs leading-relaxed mb-2.5 flex gap-1.5">
          <Info size={13} className="flex-shrink-0 mt-px text-[#D4AF37]" aria-hidden="true" />
          <span>Be honest — explicit details are fine on Unbound. Don&apos;t include contact details, anything about minors or non-consent, health information, or details that identify someone outside Unbound. If something unsafe happened, <Link href="/safety" className="text-[#FF4D6D] hover:underline">report it instead</Link>.</span>
        </p>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
          rows={6}
          maxLength={COMMENT_MAX}
          aria-describedby="review-guidelines review-count"
          aria-invalid={tried && len < COMMENT_MIN}
          className={`input-dark w-full px-4 py-3 rounded-xl text-[15px] leading-relaxed resize-y min-h-[140px] ${tried && len < COMMENT_MIN ? 'border-red-400/60' : ''}`}
          placeholder={`What was ${name} like? Were they who they said they were?`}
        />
        <p id="review-count" className="text-xs mt-1.5 flex justify-between tabular-nums" aria-live="polite">
          <span className={len < COMMENT_MIN ? 'text-white/50' : 'text-emerald-300/80'}>
            {len < COMMENT_MIN ? `${COMMENT_MIN - len} more character${COMMENT_MIN - len === 1 ? '' : 's'} needed` : 'Looks good'}
          </span>
          <span className={comment.length >= COMMENT_MAX - 20 ? 'text-[#F5D77A]' : 'text-white/45'}>{comment.length}/{COMMENT_MAX}</span>
        </p>
      </div>

      <label className="flex items-start gap-3 p-4 rounded-2xl border border-white/10 bg-white/[0.02] cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#D4AF37]">
        <input type="checkbox" checked={isExplicit} onChange={(e) => setIsExplicit(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#DC143C] flex-shrink-0" />
        <span>
          <span className="text-white text-sm font-semibold flex items-center gap-1.5"><Flame size={13} className="text-[#FF4D6D]" aria-hidden="true" />Contains explicit details</span>
          <span className="text-white/55 text-xs block mt-0.5">Your words are blurred until someone chooses to read them. Ratings always show.</span>
        </span>
      </label>

      {canAskBack && (
        <label className="flex items-start gap-3 p-4 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.04] cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#D4AF37]">
          <input type="checkbox" checked={askBack} onChange={(e) => setAskBack(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#D4AF37] flex-shrink-0" />
          <span>
            <span className="text-white text-sm font-semibold">Ask {name} to review you too</span>
            <span className="text-white/55 text-xs block mt-0.5">When you&apos;ve both reviewed each other, both reviews go live at once.</span>
          </span>
        </label>
      )}

      {error && <p role="alert" className="text-red-300 text-sm bg-red-500/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-[#DC143C]/25 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : existing ? 'Save changes' : 'Submit review'}
      </button>
      <p className="text-white/45 text-xs text-center flex items-center justify-center gap-1.5">
        <ShieldCheck size={12} aria-hidden="true" /> Hidden until {name} reviews you or {BLIND_DAYS} days pass.
      </p>
    </form>
  );
}
