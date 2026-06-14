'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import InfiniteMembers from '@/components/InfiniteMembers';
import { Lock, Crown } from 'lucide-react';
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
}

const GENDER_FILTERS = ['ALL', 'MAN', 'WOMAN', 'COUPLE'];
const GENDER_LABELS: Record<string, string> = { ALL: 'All', MAN: 'Men', WOMAN: 'Women', COUPLE: 'Couples' };

export default function MembersContent({ members, total, searchParams, canChangeCity, profileCity, profileCountry }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const [ageMin, setAgeMin] = useState(searchParams.ageMin || '18');
  const [ageMax, setAgeMax] = useState(searchParams.ageMax || '65');
  const [city, setCity] = useState(searchParams.city || profileCity || '');
  const [country, setCountry] = useState(profileCountry || '');
  const [gender, setGender] = useState(searchParams.gender || 'ALL');
  const [onlineOnly, setOnlineOnly] = useState(searchParams.online === '1');
  const [sortBy, setSortBy] = useState(searchParams.sort || 'online');

  const availableCities = country ? (CITIES_BY_COUNTRY[country] ?? []) : [];

  function applyFilters(overrides?: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const g = overrides?.gender ?? gender;
    const om = overrides?.online ?? (onlineOnly ? '1' : undefined);
    const s = overrides?.sort ?? sortBy;
    const c = canChangeCity ? city : profileCity;
    if (g && g !== 'ALL') params.set('gender', g);
    if (ageMin !== '18') params.set('ageMin', ageMin);
    if (ageMax !== '65') params.set('ageMax', ageMax);
    if (c.trim()) params.set('city', c.trim());
    if (om === '1') params.set('online', '1');
    if (s && s !== 'online') params.set('sort', s);
    params.set('page', '1');
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8 items-start sm:items-center flex-wrap">
        <div className="flex gap-2">
          {GENDER_FILTERS.map((g) => (
            <button
              key={g}
              onClick={() => { setGender(g); applyFilters({ gender: g }); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                gender === g ? 'bg-[#DC143C] text-white' : 'glass text-white/60 hover:text-white'
              }`}
            >
              {GENDER_LABELS[g]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-sm">Age:</span>
            <input
              type="number" min={18} max={99}
              value={ageMin}
              onChange={(e) => setAgeMin(e.target.value)}
              className="input-dark w-16 px-2 py-1.5 rounded-lg text-sm text-center"
              aria-label="Min age"
            />
            <span className="text-white/30">–</span>
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
              <Lock size={12} className="text-white/30" />
              <span className="text-white/50 text-sm">{profileCity || 'Your city'}</span>
              <a href="/upgrade" className="flex items-center gap-1 text-[#D4AF37] text-xs font-medium hover:underline ml-1">
                <Crown size={10} />
                Upgrade
              </a>
            </div>
          )}

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
            <span className="text-white/60 text-sm">Online Now</span>
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
        <p className="text-white/30 text-xs mb-4 flex items-center gap-1.5">
          <Lock size={10} />
          Showing members in <span className="text-white/50">{profileCity}</span>. Upgrade to Gold or Platinum to search other cities.
        </p>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p className="text-white/50 text-sm">
          Showing <span className="text-white">{members.length}</span> of <span className="text-white">{total.toLocaleString()}</span> members
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-white/30 text-xs mr-1">Sort:</span>
          {[
            { value: 'online', label: '● Online' },
            { value: 'new', label: '✦ New' },
            { value: 'verified', label: '✓ Verified' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setSortBy(value); applyFilters({ sort: value }); }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                sortBy === value ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Member Grid with Infinite Scroll */}
      {members.length === 0 ? (
        <div className="text-center py-24">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">👥</span>
          </div>
          <h3 className="text-white font-semibold text-xl mb-2">No members found</h3>
          <p className="text-white/40 text-sm mb-6">Try adjusting your filters to see more members</p>
          <button
            onClick={() => { setGender('ALL'); setCity(''); setCountry(''); setOnlineOnly(false); router.push(pathname); }}
            className="glass border border-white/20 hover:border-white/40 px-6 py-2.5 rounded-xl text-white/70 hover:text-white text-sm transition-all"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <InfiniteMembers
          initialMembers={members}
          filters={{
            gender: searchParams.gender,
            ageMin: searchParams.ageMin,
            ageMax: searchParams.ageMax,
            city: canChangeCity ? searchParams.city : profileCity,
            online: searchParams.online,
          }}
        />
      )}
    </div>
  );
}
