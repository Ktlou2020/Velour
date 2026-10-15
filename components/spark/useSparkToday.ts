'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { SparkQuestion } from '@/lib/spark';

export interface SparkToday {
  question: SparkQuestion;
  dateKey: string;
  closesAt: string;
  answered: boolean;
  myAnswer: string | null;
  count: number;
}

// One shared fetch per page for every consumer (navbar dot, tab bar).
const TTL_MS = 5 * 60 * 1000;
let cache: { data: SparkToday; at: number } | null = null;
let inflight: Promise<SparkToday | null> | null = null;
const listeners = new Set<(d: SparkToday | null) => void>();

function fetchToday(force = false): Promise<SparkToday | null> {
  const fresh = cache && Date.now() - cache.at < TTL_MS && new Date(cache.data.closesAt).getTime() > Date.now();
  if (!force && fresh) return Promise.resolve(cache!.data);
  if (inflight) return inflight;
  inflight = fetch('/api/spark/today', { cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<SparkToday>) : null))
    .then((d) => {
      if (d) { cache = { data: d, at: Date.now() }; listeners.forEach((l) => l(d)); }
      return d;
    })
    .catch(() => null)
    .finally(() => { inflight = null; });
  return inflight;
}

/** Call after answering so every consumer updates (e.g. the nav dot disappears). */
export function markSparkAnswered(answer: string) {
  if (!cache) return;
  const wasAnswered = cache.data.answered;
  cache = { data: { ...cache.data, answered: true, myAnswer: answer, count: cache.data.count + (wasAnswered ? 0 : 1) }, at: Date.now() };
  listeners.forEach((l) => l(cache!.data));
}

export function useSparkToday(): SparkToday | null {
  const { status } = useSession();
  const [data, setData] = useState<SparkToday | null>(cache?.data ?? null);
  useEffect(() => {
    if (status !== 'authenticated') return;
    listeners.add(setData);
    fetchToday().then((d) => { if (d) setData(d); });
    // Re-check occasionally (the question changes at midnight SAST).
    const id = setInterval(() => fetchToday(), TTL_MS);
    return () => { listeners.delete(setData); clearInterval(id); };
  }, [status]);
  return status === 'authenticated' ? data : null;
}
