'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  totalFetched: number;
}

export default function CJSyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/store/cj-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: 3 }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Sync failed'); return; }
      setResult(data as SyncResult);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={sync}
        disabled={loading}
        className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all"
      >
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Syncing CJ products…' : 'Sync from CJ Dropshipping'}
      </button>
      {result && (
        <p className="mt-2 text-sm text-white/60">
          Done — fetched {result.totalFetched}, <span className="text-emerald-400">{result.created} created</span>, {result.updated} updated, {result.skipped} skipped
          {result.errors.length > 0 && <span className="text-red-400"> · {result.errors.length} errors: {result.errors[0]}</span>}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
