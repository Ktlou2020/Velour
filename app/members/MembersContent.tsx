'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import InfiniteMembers from '@/components/InfiniteMembers';
import Link from 'next/link';
import { Lock, Crown, Navigation, Users } from 'lucide-react';
import { CITIES_BY_COUNTRY, COUNTRIES } from '@/lib/cities';
import type { MemberData } from './page';

interface Props {
  members: MemberData[];
  total: number;
  currentPage?: number;
  searchParams: Record<string, string | undefined>;
  canChangeCity: boolean;
  profileCity: string;
  profileCountry: string;
  callerHasLocation?: boolean;
}

// "Show me" — narrows results further. Everyone listed already wants to meet you too.
const SHOW_OPTIONS = [
  { value: 'WOMAN', label: 'Women' },
  { value: 'MAN', label: 'Men' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'COUPLE', label: 'Couples' },
];
const COUPLE_TYPES = ['MF', 'FF', 'MM', 'MX'];
const DISTANCE_OPTIONS = ['', '10', '25', '50', '100'];

export default function MembersContent({ members, total, searchParams, canChangeCity, profileCity, profileCountry, callerHasLocation = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [ageMin, setAgeMin] = useState(searchParams.ageMin || '18');
  const [ageMax, setAgeMax] = useState(searchParams.ageMax || '65');
  const [city, setCity] = useState(searchParams.city || profileCity || '');
  const [country, setCountry] = useState(profileCountry || '');
  const initialShow = (searchParams.show ?? (searchParams.gender && searchParams.gender !== 'ALL' ? searchParams.gender : ''))
    .split(',').filter(Boolean);
  const [show, setShow] = useState<string[]>(initialShow);
  const [coupleTypes, setCoupleTypes] = useState<string[]>((searchParams.coupleType ?? '').split(',').filter(Boolean));
  const [onlineOnly, setOnlineOnly] = useState(searchParams.online === '1');
  const [sortBy, setSortBy] = useState(searchParams.sort || 'online');
  const [maxKm, setMaxKm] = useState(searchParams.maxKm || '');

  const availableCities = country ? (CITIES_BY_COUNTRY[country] ?? []) : [];

  function applyFilters(overrides?: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const sh = overrides && 'show' in overrides ? overrides.show : show.join(',');
    const ct = overrides && 'coupleType' in overrides ? overrides.coupleType : coupleTypes.join(',');
    const om = overrides?.online ?? (onlineOnly ? '1' : undefined);
    const s = overrides?.sort ?? sortBy;
    const km = overrides && 'maxKm' in overrides ? overrides.maxKm : maxKm;
    const c = canChangeCity ? city : profileCity;
    if (sh) params.set('show', sh);
    if (sh?.split(',').includes('COUPLE') && ct) params.set('coupleType', ct);
    if (ageMin !== '18') params.set('ageMin', ageMin);
    if (ageMax !== '65') params.set('ageMax', ageMax);
    if (c.trim()) params.set('city', c.trim());
    if (om === '1') params.set('online', '1');
    if (s && s !== 'online') params.set('sort', s);
    if (km && callerHasLocation) params.set('maxKm', km);
    params.set('page', '1');
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8 items-start sm:items-center flex-wrap">
        <div className="w-full sm:w-auto" role="group" aria-labelledby="show-me-label">
          <div className="flex gap-2 flex-wrap items-center">
            <span id="show-me-label" className="text-white/70 text-sm mr-1">Show me</span>
            <button
              onClick={() => { setShow([]); setCoupleTypes([]); applyFilters({ show: undefined, coupleType: undefined }); }}
              aria-pressed={show.length === 0}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-sm font-medium transition-all ${show.length === 0 ? 'bg-[#DC143C] text-white' : 'glass text-white/75 hover:text-white'}`}
            >
              Everyone
            </button>
            {SHOW_OPTIONS.map((o) => {
              const on = show.includes(o.value);
              return (
                <button
                  key={o.value}
                  onClick={() => {
                    const next = on ? show.filter((v) => v !== o.value) : [...show, o.value];
                    const nextTypes = next.includes('COUPLE') ? coupleTypes : [];
                    setShow(next); setCoupleTypes(nextTypes);
                    applyFilters({ show: next.join(',') || undefined, coupleType: nextTypes.join(',') || undefined });
                  }}
                  aria-pressed={on}
                  className={`min-h-[40px] px-4 py-2 rounded-xl text-sm font-medium transition-all ${on ? 'bg-[#DC143C] text-white' : 'glass text-white/75 hover:text-white'}`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {show.includes('COUPLE') && (
            <div className="flex gap-1.5 flex-wrap items-center mt-2" role="group" aria-label="Couple type">
              <span className="text-white/55 text-xs mr-1">Couple type</span>
              {COUPLE_TYPES.map((t) => {
                const on = coupleTypes.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => {
                      const next = on ? coupleTypes.filter((v) => v !== t) : [...coupleTypes, t];
                      setCoupleTypes(next);
                      applyFilters({ coupleType: next.join(',') || undefined });
                    }}
                    aria-pressed={on}
                    title={{ MF: 'Woman & man', FF: 'Two women', MM: 'Two men', MX: 'Includes a non-binary partner' }[t]}
                    className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-semibold transition-all ${on ? 'bg-[#D4AF37] text-[#0A0A0F]' : 'glass text-white/70 hover:text-white'}`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-white/70 text-sm">Age</span>
            <input
              type="number" min={18} max={99}
              value={ageMin}
              onChange={(e) => setAgeMin(e.target.value)}
              className="input-dark w-16 px-2 py-1.5 rounded-lg text-sm text-center"
              aria-label="Min age"
            />
            <span className="text-white/55">–</span>
            <input
              type="number" min={18} max={99}
              value={ageMax}
              onChange={(e) => setAgeMax(e.target.value)}
              className="input-dark w-16 px-2 py-1.5 rounded-lg text-sm text-center"
              aria-label="Max age"
            />
          </div>

          {/* City filter — locked for FREE */}
          {canChangeCity ? (
            <div className="flex items-center gap-2">
              <select
                value={country}
                onChange={(e) => { setCountry(e.target.value); setCity(''); }}
                className="input-dark px-3 py-1.5 rounded-lg text-sm"
                aria-label="Filter by country"
              >
                <option value="">All Countries</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="input-dark px-3 py-1.5 rounded-lg text-sm"
                aria-label="Filter by city"
                disabled={!country}
              >
                <option value="">All Cities</option>
                {availableCities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-lg">
              <Lock size={12} className="text-white/55" />
              <span className="text-white/65 text-sm">{profileCity || 'Your city'}</span>
              <a href="/upgrade" className="flex items-center gap-1 text-[#D4AF37] text-xs font-medium hover:underline ml-1">
                <Crown size={10} />
                Upgrade
              </a>
            </div>
          )}

          {/* Distance filter — needs the caller's location */}
          <div className="flex items-center gap-2">
            <Navigation size={12} className="text-white/55" />
            <select
              value={callerHasLocation ? maxKm : ''}
              onChange={(e) => { setMaxKm(e.target.value); applyFilters({ maxKm: e.target.value || undefined }); }}
              className="input-dark px-3 py-1.5 rounded-lg text-sm disabled:opacity-40"
              aria-label="Filter by distance"
              disabled={!callerHasLocation}
              title={callerHasLocation ? 'Distance' : 'Set your location on your profile to filter by distance'}
            >
              {DISTANCE_OPTIONS.map((d) => (
                <option key={d || 'any'} value={d}>{d ? `Within ${d} km` : 'Any distance'}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={onlineOnly}
                onChange={(e) => { setOnlineOnly(e.target.checked); applyFilters({ online: e.target.checked ? '1' : undefined }); }}
                className="sr-only peer"
                aria-label="Online now only"
              />
              <div className="w-9 h-5 bg-white/10 rounded-full peer peer-checked:bg-[#DC143C] transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-4" />
            </div>
            <span className="text-white/70 text-sm">Online now</span>
          </label>

          <button
            onClick={() => applyFilters()}
            className="bg-[#DC143C] hover:bg-[#FF1744] text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
          >
            Apply
          </button>
        </div>
      </div>

      {!canChangeCity && profileCity && (
        <p className="text-white/60 text-xs mb-4 leading-relaxed">
          <Lock size={10} className="inline -mt-0.5 mr-1.5" aria-hidden="true" />
          Showing members in <span className="text-white/65">{profileCity}</span>. Upgrade to Gold or Platinum to search other cities.
        </p>
      )}

      {!callerHasLocation && (
        <p className="text-white/60 text-xs mb-4 leading-relaxed">
          <Navigation size={10} className="inline -mt-0.5 mr-1.5" aria-hidden="true" />
          <Link href="/profile" className="text-[#D4AF37] hover:underline">Set your location</Link>{' '}
          to see how far away members are and search by distance.
        </p>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p className="text-white/65 text-sm">
          Showing <span className="text-white">{members.length}</span> of <span className="text-white">{total.toLocaleString()}</span> members
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-white/55 text-xs mr-1">Sort:</span>
          {[
            { value: 'online', label: '● Online' },
            { value: 'new', label: '✦ New' },
            { value: 'verified', label: '✓ Verified' },
            ...(callerHasLocation ? [{ value: 'distance', label: '➤ Nearest' }] : []),
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setSortBy(value); applyFilters({ sort: value }); }}
              aria-pressed={sortBy === value}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                sortBy === value ? 'bg-white/10 text-white' : 'text-white/65 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Member Grid with Infinite Scroll */}
      {members.length === 0 ? (
        <div className="text-center py-16 sm:py-20 px-6 glass rounded-3xl">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#DC143C]/20 to-[#D4AF37]/10 border border-white/10 flex items-center justify-center mx-auto mb-5">
            <Users size={30} className="text-[#FF4D6D]" aria-hidden="true" />
          </div>
          <h2 className="font-serif text-white font-bold text-2xl mb-2">No one matches these filters — yet</h2>
          <p className="text-white/70 text-sm sm:text-base mb-7 max-w-md mx-auto">
            We only show people who&apos;d like to meet you too. Hush is new and growing every week — try widening your filters, or check who you&apos;d like to meet on your profile.
          </p>
          <button
            onClick={() => { setShow([]); setCoupleTypes([]); setCity(''); setCountry(''); setOnlineOnly(false); setMaxKm(''); router.push(pathname); }}
            className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] px-7 py-3 rounded-xl text-white text-sm font-semibold transition-all"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <InfiniteMembers
          initialMembers={members}
          filters={{
            gender: searchParams.gender,
            show: searchParams.show,
            coupleType: searchParams.coupleType,
            ageMin: searchParams.ageMin,
            ageMax: searchParams.ageMax,
            city: canChangeCity ? searchParams.city : profileCity,
            online: searchParams.online,
            sort: searchParams.sort,
            maxKm: callerHasLocation ? searchParams.maxKm : undefined,
          }}
        />
      )}
    </div>
  );
}
