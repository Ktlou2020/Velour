'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Rocket, Crown } from 'lucide-react';
import { useToast } from '@/lib/toast-context';

interface BoostState {
  paid: boolean;
  boostedUntil: string | null;
  nextAvailableAt: string | null;
  canBoost: boolean;
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function BoostCard({ className = '' }: { className?: string }) {
  const { showToast } = useToast();
  const [state, setState] = useState<BoostState | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/boost');
      if (res.ok) setState(await res.json() as BoostState);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const boostedUntilMs = state?.boostedUntil ? new Date(state.boostedUntil).getTime() : 0;
  const active = boostedUntilMs > now;

  useEffect(() => {
    if (!state?.boostedUntil) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= boostedUntilMs) { clearInterval(id); load(); }
    }, 1000);
    return () => clearInterval(id);
  }, [state?.boostedUntil, boostedUntilMs, load]);

  async function boost() {
    setLoading(true);
    try {
      const res = await fetch('/api/boost', { method: 'POST' });
      const data = await res.json().catch(() => ({})) as Partial<BoostState> & { error?: string };
      if (res.ok) {
        setState({
          paid: true,
          boostedUntil: (data.boostedUntil as string) ?? null,
          nextAvailableAt: (data.nextAvailableAt as string) ?? null,
          canBoost: false,
        });
        setNow(Date.now());
        showToast('Your profile is boosted for 30 minutes!', 'success');
      } else {
        showToast(data.error ?? 'Could not boost your profile', 'error');
        load();
      }
    } finally {
      setLoading(false);
    }
  }

  if (!state) return null;

  return (
    <div className={`glass rounded-2xl p-6 border border-[#D4AF37]/15 ${className}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-white font-semibold flex items-center gap-2 mb-1">
            <Rocket size={16} className="text-[#D4AF37]" />
            Profile Boost
          </h2>
          {!state.paid ? (
            <p className="text-white/60 text-sm">Jump to the top of search for 30 minutes. Gold members get 1 boost a month, Platinum members get one every week.</p>
          ) : active ? (
            <p className="text-[#D4AF37] text-sm font-medium">
              Boost active — <span className="font-mono">{formatCountdown(boostedUntilMs - now)}</span> remaining
            </p>
          ) : state.canBoost ? (
            <p className="text-white/60 text-sm">Put your profile at the top of search results for 30 minutes.</p>
          ) : (
            <p className="text-white/60 text-sm">
              Next boost available on{' '}
              <span className="text-white/70">
                {state.nextAvailableAt
                  ? new Date(state.nextAvailableAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                  : '—'}
              </span>
            </p>
          )}
        </div>
        {!state.paid ? (
          <Link href="/upgrade" className="flex items-center gap-1.5 bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] font-bold px-5 py-2.5 rounded-xl text-sm hover:from-[#F4D03F] hover:to-[#D4AF37] transition-all whitespace-nowrap">
            <Crown size={14} /> Upgrade to Boost
          </Link>
        ) : (
          <button
            onClick={boost}
            disabled={loading || active || !state.canBoost}
            className="flex items-center gap-1.5 bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] font-bold px-5 py-2.5 rounded-xl text-sm hover:from-[#F4D03F] hover:to-[#D4AF37] transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <div className="w-4 h-4 border-2 border-[#0A0A0F] border-t-transparent rounded-full animate-spin" /> : <Rocket size={14} />}
            {active ? 'Boosted' : 'Boost Now'}
          </button>
        )}
      </div>
    </div>
  );
}
