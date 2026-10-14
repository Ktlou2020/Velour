'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Edit2, Loader2, MessageCircle, Sparkles, Users } from 'lucide-react';
import ProtectedImage from '@/components/ProtectedImage';
import EmptyState from '@/components/EmptyState';
import SparkAnswers from '@/components/spark/SparkAnswers';
import { markSparkAnswered } from '@/components/spark/useSparkToday';
import { useToast } from '@/lib/toast-context';
import { SPARK_TEXT_MAX, sparkReplyDraft, type SparkQuestion } from '@/lib/spark';
import type { SparkFeedItem, SparkHistoryItem } from '@/app/api/spark/data';

export interface SparkInitial {
  question: SparkQuestion;
  dateKey: string;
  closesAt: string;
  myAnswer: string | null;
  count: number;
  streak: { current: number; best: number; answeredToday: boolean };
  history: SparkHistoryItem[];
  feed: SparkFeedItem[] | null;
  nextCursor: string | null;
  feedTotal: number | null;
  sameCount: number | null;
}

type Filter = 'all' | 'same';

function hoursLeft(closesAt: string): string {
  const ms = new Date(closesAt).getTime() - Date.now();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.max(0, Math.floor((ms % 3_600_000) / 60_000));
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function SparkClient({ initial }: { initial: SparkInitial }) {
  const router = useRouter();
  const { showToast } = useToast();
  const q = initial.question;
  const isPick = !!q.options;

  const [myAnswer, setMyAnswer] = useState<string | null>(initial.myAnswer);
  const [editing, setEditing] = useState(!initial.myAnswer);
  const [draft, setDraft] = useState(initial.myAnswer ?? '');
  const [saving, setSaving] = useState(false);
  const [streak, setStreak] = useState(initial.streak);
  const [count, setCount] = useState(initial.count);

  const [filter, setFilter] = useState<Filter>('all');
  const [feed, setFeed] = useState<SparkFeedItem[] | null>(initial.feed);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [feedTotal, setFeedTotal] = useState<number | null>(initial.feedTotal);
  const [sameCount, setSameCount] = useState<number | null>(initial.sameCount);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [replying, setReplying] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  const dateLabel = new Date(`${initial.dateKey}T12:00:00Z`).toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Johannesburg',
  });

  useEffect(() => {
    const tick = () => setTimeLeft(hoursLeft(initial.closesAt));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [initial.closesAt]);

  async function loadFeed(nextFilter: Filter, append: boolean) {
    setLoadingFeed(true);
    try {
      const params = new URLSearchParams({ feedOnly: '1' });
      if (nextFilter === 'same') params.set('filter', 'same');
      if (append && cursor) params.set('cursor', cursor);
      const res = await fetch(`/api/spark?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json() as { feed: SparkFeedItem[] | null; nextCursor: string | null; feedTotal: number | null; sameCount: number | null; count: number };
      setFeed((prev) => (append && prev ? [...prev, ...(data.feed ?? [])] : data.feed));
      setCursor(data.nextCursor);
      setFeedTotal(data.feedTotal);
      setSameCount(data.sameCount);
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
      const data = await res.json().catch(() => ({})) as { error?: string; myAnswer?: string; streak?: SparkInitial['streak'] };
      if (!res.ok || !data.myAnswer) { showToast(data.error ?? 'Could not save your answer', 'error'); return; }
      const first = !myAnswer;
      setMyAnswer(data.myAnswer);
      setDraft(data.myAnswer);
      setEditing(false);
      if (data.streak) setStreak(data.streak);
      if (first) setCount((c) => c + 1);
      markSparkAnswered(data.myAnswer);
      showToast(first ? 'Answer shared ✨' : 'Answer updated', 'success');
      setFilter('all');
      await loadFeed('all', false);
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function reply(item: SparkFeedItem) {
    setReplying(item.id);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUsername: item.username }),
      });
      const data = await res.json().catch(() => ({})) as { conversation?: { id: string }; error?: string };
      if (!res.ok || !data.conversation?.id) {
        showToast(data.error ?? 'You can’t message this member right now', 'error');
        return;
      }
      const text = sparkReplyDraft(q.text, item.answer);
      router.push(`/messages?conv=${encodeURIComponent(data.conversation.id)}&draft=${encodeURIComponent(text)}`);
    } catch {
      showToast('Network error', 'error');
    } finally {
      setReplying(null);
    }
  }

  const others = Math.max(0, count - (myAnswer ? 1 : 0));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      {/* ─── Hero question ─────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/20 bg-gradient-to-br from-[#2A0812] via-[#150A16] to-[#0F0A1E] p-6 sm:p-10 shadow-2xl shadow-black/40"
        aria-labelledby="spark-question"
      >
        <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#DC143C]/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[#D4AF37]/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <p className="eyebrow text-[#D4AF37] flex items-center gap-1.5">
              <Sparkles size={13} aria-hidden="true" /> Daily Spark
            </p>
            {streak.current >= 2 ? (
              <span className="rounded-full border border-[#FF4D6D]/30 bg-[#DC143C]/10 px-3 py-1 text-xs font-semibold text-[#FFB3C1]">
                🔥 {streak.current}-day Spark streak
              </span>
            ) : (
              <span className="text-white/45 text-xs">{dateLabel}</span>
            )}
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
                  rows={3}
                  placeholder={q.placeholder ?? 'Your answer…'}
                  className="input-dark w-full resize-none text-base"
                />
                <div className="flex items-center justify-between mt-3 gap-3">
                  <span className="text-white/45 text-xs">{draft.length}/{SPARK_TEXT_MAX}</span>
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
                      {saving ? 'Sharing…' : myAnswer ? 'Update' : 'Share answer'}
                    </button>
                  </div>
                </div>
              </form>
            )
          ) : (
            <div className="rounded-2xl border border-[#D4AF37]/25 bg-black/20 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white/50 text-xs mb-1 flex items-center gap-1"><Check size={12} className="text-emerald-400" /> Your answer</p>
                  <p className="text-white font-serif text-xl leading-snug break-words">{myAnswer}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white glass px-3 py-1.5 rounded-lg"
                >
                  <Edit2 size={12} /> Edit
                </button>
              </div>
            </div>
          )}

          <p className="text-white/45 text-xs mt-5" aria-live="polite">
            {timeLeft ? <>New question in {timeLeft} · </> : null}
            {myAnswer ? 'Editable until midnight.' : 'Answer to see what others said.'}
          </p>
        </div>
      </section>

      {/* ─── Feed ──────────────────────────────────────────────────── */}
      <section className="mt-8" aria-labelledby="feed-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 id="feed-heading" className="font-serif text-xl font-bold text-white">What others said</h2>
          {myAnswer && isPick && (
            <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1" role="tablist" aria-label="Filter answers">
              {(['all', 'same'] as Filter[]).map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => { setFilter(f); loadFeed(f, false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === f ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white'}`}
                >
                  {f === 'all' ? `All${feedTotal !== null ? ` · ${feedTotal}` : ''}` : `Same as you${sameCount !== null ? ` · ${sameCount}` : ''}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {!myAnswer ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/5">
            <div aria-hidden="true" className="space-y-3 p-4 blur-[6px] opacity-50 select-none">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3">
                  <div className="h-11 w-11 rounded-full bg-white/10" />
                  <div className="flex-1 space-y-2"><div className="h-3 w-1/3 rounded bg-white/15" /><div className="h-3 w-2/3 rounded bg-white/10" /></div>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-[#0A0A0F]/40">
              <Users size={22} className="text-[#D4AF37] mb-2" aria-hidden="true" />
              <p className="text-white font-semibold">
                {others > 0 ? `${others} member${others === 1 ? ' has' : 's have'} answered today` : 'Be the first to answer today'}
              </p>
              <p className="text-white/60 text-sm mt-1">Share yours to see what they said.</p>
            </div>
          </div>
        ) : feed && feed.length > 0 ? (
          <>
            <ul className="space-y-3">
              {feed.map((item) => (
                <li key={item.id} className="glass rounded-2xl p-4 flex gap-3.5">
                  <Link href={`/members/${item.username}`} className="flex-shrink-0" aria-label={`View ${item.displayName}'s profile`}>
                    <div className="h-12 w-12 rounded-full overflow-hidden bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center">
                      {item.photoUrl ? (
                        <ProtectedImage src={item.photoUrl} alt="" className="h-full w-full" watermark="" />
                      ) : (
                        <span className="text-white text-sm font-bold">{item.displayName.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <Link href={`/members/${item.username}`} className="text-white font-semibold text-sm hover:underline truncate max-w-full">
                        {item.displayName}
                      </Link>
                      <span className="text-white/50 text-xs">
                        {[item.ageLabel, item.city].filter(Boolean).join(' · ')}
                      </span>
                      {item.sameAsMe && (
                        <span className="rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 px-2 py-0.5 text-[10px] font-semibold text-[#F3E3A6]">Same as you</span>
                      )}
                    </div>
                    <p className={`mt-1.5 break-words ${isPick ? 'text-white/85 text-sm' : 'text-white font-serif text-[17px] leading-snug'}`}>{item.answer}</p>
                    <button
                      type="button"
                      onClick={() => reply(item)}
                      disabled={replying === item.id}
                      className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF4D6D] hover:text-[#FF85A1] disabled:opacity-60"
                    >
                      {replying === item.id ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
                      Reply
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {cursor && (
              <div className="text-center mt-5">
                <button
                  type="button"
                  onClick={() => loadFeed(filter, true)}
                  disabled={loadingFeed}
                  className="glass px-5 py-2.5 rounded-xl text-sm text-white/75 hover:text-white disabled:opacity-60"
                >
                  {loadingFeed ? 'Loading…' : 'Show more'}
                </button>
              </div>
            )}
          </>
        ) : loadingFeed ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
          </div>
        ) : (
          <div className="glass rounded-2xl">
            <EmptyState
              compact
              icon={Sparkles}
              title={filter === 'same' ? 'No twins yet' : 'You’re early'}
              description={filter === 'same' ? 'Nobody has picked the same answer yet — check back later today.' : 'Nobody you could meet has answered yet. Check back later — the answers roll in through the day.'}
              action={{ label: 'Browse members', href: '/members' }}
            />
          </div>
        )}
      </section>

      {/* ─── History ───────────────────────────────────────────────── */}
      <SparkAnswers
        className="mt-8"
        title="Your previous Sparks"
        answers={initial.history}
        emptyText="Your answers from previous days will appear here — and the last few show on your profile."
        footer={streak.best >= 2 ? <p className="text-white/45 text-xs mt-4">Best streak: {streak.best} days</p> : undefined}
      />
    </div>
  );
}
