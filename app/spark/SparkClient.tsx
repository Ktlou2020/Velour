'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import ProtectedImage from '@/components/ProtectedImage';
import { markSparkAnswered } from '@/components/spark/useSparkToday';
import { useToast } from '@/lib/toast-context';
import { SPARK_TEXT_MAX, type SparkQuestion } from '@/lib/spark';
import type { SparkFeedItem } from '@/app/api/spark/data';

export interface SparkInitial {
  question: SparkQuestion;
  dateKey: string;
  myAnswer: string | null;
  count: number;
  feed: SparkFeedItem[] | null;
  nextCursor: string | null;
}

export default function SparkClient({ initial }: { initial: SparkInitial }) {
  const { showToast } = useToast();
  const q = initial.question;
  const isPick = !!q.options;

  const [myAnswer, setMyAnswer] = useState<string | null>(initial.myAnswer);
  const [editing, setEditing] = useState(!initial.myAnswer);
  const [draft, setDraft] = useState(initial.myAnswer ?? '');
  const [saving, setSaving] = useState(false);
  const [count, setCount] = useState(initial.count);
  const [feed, setFeed] = useState<SparkFeedItem[] | null>(initial.feed);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loadingFeed, setLoadingFeed] = useState(false);

  const dateLabel = new Date(`${initial.dateKey}T12:00:00Z`).toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Johannesburg',
  });

  async function loadFeed(append: boolean) {
    setLoadingFeed(true);
    try {
      const params = new URLSearchParams();
      if (append && cursor) params.set('cursor', cursor);
      const res = await fetch(`/api/spark?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json() as { feed: SparkFeedItem[] | null; nextCursor: string | null; count: number };
      setFeed((prev) => (append && prev ? [...prev, ...(data.feed ?? [])] : data.feed));
      setCursor(data.nextCursor);
      setCount(data.count);
    } catch {
      showToast('Could not load answers', 'error');
    } finally {
      setLoadingFeed(false);
    }
  }

  async function submit(answer: string) {
    const value = answer.trim();
    if (!value) return;
    setSaving(true);
    try {
      const res = await fetch('/api/spark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: value }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; myAnswer?: string };
      if (!res.ok || !data.myAnswer) { showToast(data.error ?? 'Could not save your answer', 'error'); return; }
      const first = !myAnswer;
      setMyAnswer(data.myAnswer);
      setDraft(data.myAnswer);
      setEditing(false);
      if (first) setCount((c) => c + 1);
      markSparkAnswered(data.myAnswer);
      showToast(first ? 'Answer shared ✨' : 'Answer updated', 'success');
      await loadFeed(false);
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  }

  const others = Math.max(0, count - (myAnswer ? 1 : 0));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      {/* ─── Today's question ──────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/20 bg-gradient-to-br from-[#2A0812] via-[#150A16] to-[#0F0A1E] p-6 sm:p-10 shadow-2xl shadow-black/40"
        aria-labelledby="spark-question"
      >
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#DC143C]/20 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <p className="eyebrow text-[#D4AF37] flex items-center gap-1.5">
              <Sparkles size={13} aria-hidden="true" /> Daily Spark
            </p>
            <span className="text-white/45 text-xs">{dateLabel}</span>
          </div>
          <h1 id="spark-question" className="font-serif text-2xl sm:text-4xl font-bold text-white leading-tight text-balance mb-6">
            {q.text}
          </h1>

          {editing ? (
            isPick ? (
              <div className="grid sm:grid-cols-2 gap-2.5" role="group" aria-label="Choose your answer">
                {q.options!.map((o) => {
                  const selected = myAnswer === o;
                  return (
                    <button
                      key={o}
                      type="button"
                      onClick={() => submit(o)}
                      disabled={saving}
                      aria-pressed={selected}
                      className={`text-left rounded-2xl border px-4 py-3.5 text-[15px] font-medium transition-all disabled:opacity-60 motion-safe:active:scale-[0.98] ${selected ? 'border-[#D4AF37]/70 bg-[#D4AF37]/15 text-white' : 'border-white/10 bg-white/[0.04] text-white/85 hover:border-[#D4AF37]/50 hover:bg-white/[0.07]'}`}
                    >
                      {o}
                    </button>
                  );
                })}
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); submit(draft); }}>
                <label htmlFor="spark-answer" className="sr-only">Your answer</label>
                <textarea
                  id="spark-answer"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, SPARK_TEXT_MAX))}
                  maxLength={SPARK_TEXT_MAX}
                  rows={2}
                  placeholder={q.placeholder ?? 'Your answer…'}
                  className="input-dark w-full resize-none text-base"
                />
                <div className="flex items-center justify-between mt-3 gap-3">
                  <span className="text-white/45 text-xs" aria-hidden="true">{draft.length}/{SPARK_TEXT_MAX}</span>
                  <div className="flex gap-2">
                    {myAnswer && (
                      <button type="button" onClick={() => { setDraft(myAnswer); setEditing(false); }} className="glass px-4 py-2.5 rounded-xl text-sm text-white/70 hover:text-white">
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={saving || !draft.trim()}
                      className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
                    >
                      {saving ? 'Sharing…' : myAnswer ? 'Update' : 'Share'}
                    </button>
                  </div>
                </div>
              </form>
            )
          ) : (
            <div className="rounded-2xl border border-[#D4AF37]/25 bg-black/20 p-4 sm:p-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white/50 text-xs mb-1 flex items-center gap-1"><Check size={12} className="text-emerald-400" aria-hidden="true" /> Your answer</p>
                <p className="text-white font-serif text-xl leading-snug break-words">{myAnswer}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex-shrink-0 text-xs text-white/60 hover:text-white glass px-3 py-1.5 rounded-lg"
              >
                Change
              </button>
            </div>
          )}

          <p className="text-white/45 text-xs mt-5">A new question every day.</p>
        </div>
      </section>

      {/* ─── How others answered (after you answer) ───────────────── */}
      <section className="mt-8" aria-labelledby="feed-heading" aria-busy={loadingFeed}>
        <h2 id="feed-heading" className="font-serif text-xl font-bold text-white mb-4">How others answered</h2>

        {!myAnswer ? (
          <p className="glass rounded-2xl p-5 text-white/65 text-sm">
            {others > 0
              ? `${others} member${others === 1 ? ' has' : 's have'} answered. Share yours to see theirs.`
              : 'Be the first to answer today.'}
          </p>
        ) : feed && feed.length > 0 ? (
          <>
            <ul className="space-y-2.5">
              {feed.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/members/${item.username}`}
                    className="glass rounded-2xl p-3.5 flex items-center gap-3 hover:bg-white/[0.06] transition-colors"
                  >
                    <div className="h-11 w-11 flex-shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center">
                      {item.photoUrl ? (
                        <ProtectedImage src={item.photoUrl} alt="" className="h-full w-full" watermark="" />
                      ) : (
                        <span className="text-white text-sm font-bold" aria-hidden="true">{item.displayName.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white/55 text-xs truncate">
                        <span className="text-white font-semibold text-sm">{item.displayName}</span>
                        {[item.ageLabel, item.city].filter(Boolean).length > 0 && ` · ${[item.ageLabel, item.city].filter(Boolean).join(' · ')}`}
                      </p>
                      <p className="mt-0.5 text-white/85 text-[15px] leading-snug break-words">{item.answer}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {cursor && (
              <div className="text-center mt-5">
                <button
                  type="button"
                  onClick={() => loadFeed(true)}
                  disabled={loadingFeed}
                  className="glass px-5 py-2.5 rounded-xl text-sm text-white/75 hover:text-white disabled:opacity-60"
                >
                  {loadingFeed ? 'Loading…' : 'Show more'}
                </button>
              </div>
            )}
          </>
        ) : loadingFeed ? (
          <div className="space-y-2.5">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[72px] rounded-2xl" />)}
          </div>
        ) : (
          <p className="glass rounded-2xl p-5 text-white/65 text-sm">
            No one else has answered yet — check back later today.
          </p>
        )}
      </section>
    </div>
  );
}
