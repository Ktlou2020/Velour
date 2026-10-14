'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useToast } from '@/lib/toast-context';
import { markSparkAnswered, useSparkToday } from './useSparkToday';

/**
 * Compact Daily Spark card to drop into any signed-in page (members,
 * discover, matches…). Quick-pick questions can be answered inline; open
 * questions link to /spark. Renders nothing while loading or signed out.
 */
export default function SparkCard({ className = '' }: { className?: string }) {
  const today = useSparkToday();
  const { showToast } = useToast();
  const [saving, setSaving] = useState<string | null>(null);

  if (!today) return null;
  const { question, answered, myAnswer, count } = today;
  const others = Math.max(0, count - (answered ? 1 : 0));

  async function pick(option: string) {
    setSaving(option);
    try {
      const res = await fetch('/api/spark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: option }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { showToast(data.error ?? 'Could not save your answer', 'error'); return; }
      markSparkAnswered(option);
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSaving(null);
    }
  }

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-[#D4AF37]/20 bg-gradient-to-br from-[#1A0710] via-[#120A14] to-[#0F0A1E] p-5 ${className}`}
      aria-labelledby="spark-card-q"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-[#DC143C]/15 blur-3xl" />
      <div className="relative">
        <p className="eyebrow text-[#D4AF37] flex items-center gap-1.5 mb-2">
          <Sparkles size={12} aria-hidden="true" /> Daily Spark
        </p>
        <h3 id="spark-card-q" className="font-serif text-lg sm:text-xl font-bold text-white leading-snug mb-4">{question.text}</h3>

        {answered ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-white/70 text-sm min-w-0">
              You said <span className="text-[#F3E3A6] font-medium break-words">“{myAnswer}”</span>
            </p>
            <Link href="/spark" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:text-[#FF4D6D] transition-colors">
              {others > 0 ? `See ${others} other answer${others === 1 ? '' : 's'}` : 'See answers'} <ArrowRight size={14} />
            </Link>
          </div>
        ) : question.options ? (
          <div className="flex flex-wrap gap-2">
            {question.options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => pick(o)}
                disabled={!!saving}
                className="rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-sm text-white/85 hover:border-[#D4AF37]/50 hover:text-white transition-colors disabled:opacity-60"
              >
                {saving === o ? 'Saving…' : o}
              </button>
            ))}
          </div>
        ) : (
          <Link
            href="/spark"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#DC143C] to-[#8F0D25] px-4 py-2 text-sm font-semibold text-white hover:from-[#FF1744] hover:to-[#DC143C] transition-all"
          >
            Answer today&apos;s Spark <ArrowRight size={14} />
          </Link>
        )}
        {!answered && (
          <p className="text-white/45 text-xs mt-3">
            {others > 0 ? `${others} member${others === 1 ? ' has' : 's have'} answered — answer to see theirs.` : 'Be one of the first to answer today.'}
          </p>
        )}
      </div>
    </section>
  );
}
