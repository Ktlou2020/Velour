'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Loader2, ShieldCheck } from 'lucide-react';
import { distanceKm } from '@/lib/geo';

const REFRESH_KM = 5;

async function saveLocation(lat: number, lng: number): Promise<boolean> {
  try {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Location-first search helper.
 *  - No stored location: a friendly "See who's near you" card that asks for
 *    the browser location once and saves it (rounded to ~1 km server-side).
 *  - Stored location + permission already granted: silently refreshes it when
 *    the member has moved more than 5 km. Never prompts on its own.
 */
export default function LocationPrompt({
  hasLocation, lat, lng, className = '', onSaved,
}: {
  hasLocation: boolean;
  lat?: number | null;
  lng?: number | null;
  className?: string;
  /** Called after a location was saved (defaults to a router refresh). */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);
  const done = onSaved ?? (() => router.refresh());

  // Silent refresh — only when permission is already granted.
  useEffect(() => {
    if (!hasLocation || lat == null || lng == null) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation || !navigator.permissions?.query) return;
    let cancelled = false;
    navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((st) => {
      if (cancelled || st.state !== 'granted') return;
      navigator.geolocation.getCurrentPosition(async (pos) => {
        if (cancelled) return;
        const moved = distanceKm(lat, lng, pos.coords.latitude, pos.coords.longitude);
        if (moved > REFRESH_KM && (await saveLocation(pos.coords.latitude, pos.coords.longitude)) && !cancelled) done();
      }, () => {}, { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 });
    }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLocation, lat, lng]);

  if (hasLocation) return null;

  function useMyLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setDenied('Your browser can’t share a location. You’re seeing everyone instead.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const ok = await saveLocation(pos.coords.latitude, pos.coords.longitude);
        setBusy(false);
        if (ok) done();
        else setDenied('We couldn’t save your location just now. You’re seeing everyone instead.');
      },
      (err) => {
        setBusy(false);
        setDenied(err.code === err.PERMISSION_DENIED
          ? 'Location is off, so you’re seeing everyone. Turn on location to sort by distance.'
          : 'We couldn’t find your location. You’re seeing everyone instead.');
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  }

  return (
    <section
      aria-labelledby="near-you-title"
      className={`relative overflow-hidden rounded-2xl border border-[#DC143C]/25 bg-gradient-to-br from-[#DC143C]/[0.12] via-white/[0.03] to-[#D4AF37]/[0.06] p-5 sm:p-6 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#DC143C]/15 border border-[#DC143C]/30 flex items-center justify-center flex-shrink-0">
          <MapPin size={22} className="text-[#FF4D6D]" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 id="near-you-title" className="text-white font-serif text-lg sm:text-xl font-bold">See who&apos;s near you</h2>
          <p className="text-white/65 text-sm mt-0.5">
            {denied ?? 'Share your location once and we’ll show members by distance — with an estimate like “≈ 12 km away”.'}
          </p>
          <p className="text-white/45 text-xs mt-1.5 flex items-center gap-1">
            <ShieldCheck size={12} aria-hidden="true" /> We only show approximate distance, never your exact location.
          </p>
        </div>
        <button
          onClick={useMyLocation}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 bg-[#DC143C] hover:bg-[#FF1744] text-white px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60 whitespace-nowrap"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
          {denied ? 'Try again' : 'Use my location'}
        </button>
      </div>
    </section>
  );
}
