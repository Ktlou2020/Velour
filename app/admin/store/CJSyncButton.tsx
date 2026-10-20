'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  totalFetched: number;
  totalInDb?: number;
}

// Each sync call runs one keyword to avoid timeout
const KEYWORDS = [
  'vibrator', 'dildo', 'sex toy', 'lingerie',
  'sexy costume', 'sexy underwear', 'adult toy', 'butt plug', 'handcuffs restraint',
];

export default function CJSyncButton() {
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanMsg, setCleanMsg] = useState('');
  const [progress, setProgress] = useState('');
  const [totals, setTotals] = useState({ created: 0, updated: 0, skipped: 0, fetched: 0 });
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  async function cleanup() {
    setCleaning(true);
    setCleanMsg('');
    try {
      const res = await fetch('/api/admin/store/cj-cleanup', { method: 'POST' });
      const data = await res.json() as { deleted: number; message?: string; names?: string[] };
      setCleanMsg(`Removed ${data.deleted} non-adult products${data.names?.length ? ': ' + data.names.join(', ') : ''}`);
    } catch {
      setCleanMsg('Cleanup failed');
    } finally {
      setCleaning(false);
    }
  }

  async function sync() {
    setLoading(true);
    setDone(false);
    setErrors([]);
    setTotals({ created: 0, updated: 0, skipped: 0, fetched: 0 });

    let created = 0, updated = 0, skipped = 0, fetched = 0, lastDbTotal = 0;
    const allErrors: string[] = [];

    for (const keyword of KEYWORDS) {
      setProgress(`Syncing "${keyword}"…`);
      try {
        const res = await fetch('/api/admin/store/cj-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords: [keyword], pages: 3 }),
        });
        const data: SyncResult = await res.json();
        if (res.ok) {
          created += data.created;
          updated += data.updated;
          skipped += data.skipped;
          fetched += data.totalFetched;
          lastDbTotal = data.totalInDb ?? lastDbTotal;
          allErrors.push(...data.errors);
          setTotals({ created, updated, skipped, fetched });
        } else {
          allErrors.push(`${keyword}: ${(data as { error?: string }).error ?? 'failed'}`);
        }
      } catch {
        allErrors.push(`${keyword}: network error`);
      }
      setErrors([...allErrors]);
    }

    setProgress(`Done — ${lastDbTotal} active products in store`);
    setDone(true);
    setLoading(false);
  }

  return (
    <div className="mt-2">
      <button
        onClick={sync}
        disabled={loading}
        className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all"
      >
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        {loading ? progress || 'Starting sync…' : 'Sync from CJ Dropshipping'}
      </button>
      {(loading || done) && (
        <p className="mt-2 text-sm text-white/60">
          Fetched {totals.fetched} · <span className="text-emerald-400">{totals.created} created</span> · {totals.updated} updated · {totals.skipped} skipped
          {errors.length > 0 && <span className="text-red-400"> · {errors.length} errors: {errors[0]}</span>}
        </p>
      )}
      {errors.length > 0 && (
        <p className="mt-1 text-xs text-red-400">{errors[0]}</p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={cleanup}
          disabled={cleaning || loading}
          className="text-xs text-white/40 hover:text-red-400 underline disabled:opacity-40 transition-colors"
        >
          {cleaning ? 'Removing…' : 'Remove non-adult products'}
        </button>
        {cleanMsg && <span className="text-xs text-white/50">{cleanMsg}</span>}
      </div>
    </div>
  );
}
