'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plane, Loader2 } from 'lucide-react';
import { CITIES_BY_COUNTRY, COUNTRIES } from '@/lib/cities';
import { useToast } from '@/lib/toast-context';
import PlanChip from './PlanChip';

interface TravelState {
  entitled: boolean;
  active: boolean;
  city: string | null;
  country: string | null;
  until: string | null;
  homeCity: string | null;
  maxDays: number;
}

/** YYYY-MM-DD for a date in South African time. */
function sastDate(offsetDays = 0): string {
  return new Date(Date.now() + 2 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);
}

export function formatTravelUntil(until: string | Date): string {
  return new Date(until).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' });
}

/** Travel mode settings (Gold+). Free members see the card locked. */
export default function TravelModeCard({ className = '' }: { className?: string }) {
  const { showToast } = useToast();
  const [state, setState] = useState<TravelState | null>(null);
  const [country, setCountry] = useState('South Africa');
  const [city, setCity] = useState('');
  const [until, setUntil] = useState(sastDate(7));
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetch('/api/travel').then((r) => (r.ok ? r.json() : null)).then((d: TravelState | null) => {
      if (!d) return;
      setState(d);
      if (d.active && d.country) { setCountry(d.country); setCity(d.city ?? ''); }
      if (d.active && d.until) setUntil(new Date(new Date(d.until).getTime() + 2 * 3600_000).toISOString().slice(0, 10));
    }).catch(() => {});
  }, []);

  async function save() {
    if (!city) { showToast('Choose a city', 'error'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country, city, until }),
      });
      const d = await res.json().catch(() => ({})) as TravelState & { error?: string };
      if (!res.ok) { showToast(d.error ?? 'Could not set travel mode', 'error'); return; }
      setState(d); setEditing(false);
      showToast(`You're exploring ${d.city} until ${formatTravelUntil(d.until!)}`, 'success');
    } catch {
      showToast('Network error', 'error');
    } finally { setBusy(false); }
  }

  async function stop() {
    setBusy(true);
    try {
      const res = await fetch('/api/travel', { method: 'DELETE' });
      if (res.ok) { setState(await res.json()); showToast('Welcome home — travel mode is off', 'success'); }
    } catch {
      showToast('Network error', 'error');
    } finally { setBusy(false); }
  }

  const locked = state ? !state.entitled : false;
  const cities = CITIES_BY_COUNTRY[country] ?? [];

  return (
    <section id="travel" aria-labelledby="travel-title" className={`glass rounded-2xl p-6 scroll-mt-24 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <Plane size={20} className="text-sky-300" aria-hidden="true" />
        <h2 id="travel-title" className="text-white font-semibold">Travel mode</h2>
        {locked && <PlanChip tier="GOLD" className="ml-auto" />}
      </div>
      <p className="text-white/65 text-sm mb-4 leading-relaxed">
        Heading somewhere? Browse, discover and get today&apos;s picks in another city for up to {state?.maxDays ?? 30} days — and show up there with a small &ldquo;Visiting&rdquo; badge so locals know you&apos;re in town.
      </p>

      {!state ? (
        <div className="h-10 rounded-xl skeleton" aria-hidden="true" />
      ) : locked ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.04] p-4">
          <p className="text-white/70 text-sm flex-1">Travel mode is part of Gold and Platinum. You&apos;re currently browsing {state.homeCity ? <span className="text-white">{state.homeCity}</span> : 'your home city'}.</p>
          <Link href="/upgrade#compare" className="inline-flex justify-center items-center bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] font-bold px-4 py-2 rounded-lg text-xs whitespace-nowrap">
            See Gold
          </Link>
        </div>
      ) : state.active && !editing ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-sky-200 text-sm font-medium flex-1">
            <span aria-hidden="true">✈ </span>Exploring {state.city} until {formatTravelUntil(state.until!)}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="glass border border-white/15 hover:border-white/30 text-white px-4 py-2 rounded-xl text-sm">Change</button>
            <button onClick={stop} disabled={busy} className="glass border border-white/15 hover:border-red-400/40 hover:text-red-300 text-white/70 px-4 py-2 rounded-xl text-sm disabled:opacity-50">I&apos;m home</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="block">
              <span className="text-white/55 text-xs">Country</span>
              <select value={country} onChange={(e) => { setCountry(e.target.value); setCity(''); }} className="input-dark w-full mt-1 px-3 py-2 rounded-xl text-sm">
                {COUNTRIES.filter((c) => (CITIES_BY_COUNTRY[c] ?? []).length).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-white/55 text-xs">City</span>
              <select value={city} onChange={(e) => setCity(e.target.value)} className="input-dark w-full mt-1 px-3 py-2 rounded-xl text-sm">
                <option value="">Choose a city</option>
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-white/55 text-xs">Until</span>
              <input type="date" value={until} min={sastDate(0)} max={sastDate(state.maxDays)} onChange={(e) => setUntil(e.target.value)} className="input-dark w-full mt-1 px-3 py-2 rounded-xl text-sm [color-scheme:dark]" />
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy || !city} className="flex items-center gap-2 bg-[#DC143C] hover:bg-[#FF1744] text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plane size={14} />}
              {state.active ? 'Update trip' : 'Start exploring'}
            </button>
            {editing && <button onClick={() => setEditing(false)} className="glass px-4 py-2.5 rounded-xl text-white/60 text-sm">Cancel</button>}
          </div>
        </div>
      )}
    </section>
  );
}
