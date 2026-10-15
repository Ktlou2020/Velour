'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import InfiniteMembers, { MemberTile } from '@/components/InfiniteMembers';
import Link from 'next/link';
import { Lock, Navigation, Users, SlidersHorizontal, Plane, Sparkles, ChevronDown } from 'lucide-react';
import { CITIES_BY_COUNTRY, COUNTRIES } from '@/lib/cities';
import { BODY_TYPE_OPTIONS, INTENTION_OPTIONS, LANGUAGE_OPTIONS } from '@/lib/identity';
import PlanChip from '@/components/plans/PlanChip';
import UpgradeNudge from '@/components/plans/UpgradeNudge';
import LocationPrompt from '@/components/plans/LocationPrompt';
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
  /** Plan includes advanced filters (Gold+). */
  advancedFilters?: boolean;
  /** Active travel mode, if any. */
  travel?: { city: string; until: string } | null;
  canTravel?: boolean;
  spotlight?: MemberData[];
  /** Radius applied by the server (null = Anywhere / no location). */
  radiusKm?: number | null;
  /** Plan's largest radius (null = Anywhere allowed). */
  maxRadiusKm?: number | null;
  sort?: 'nearest' | 'active' | 'new' | 'match';
  unknownDistance?: number;
  /** Known-distance members inside the radius, and how many follow in "Further away". */
  inRadius?: number;
  furtherAway?: number;
  homeLat?: number | null;
  homeLng?: number | null;
}

const RADII = ['10', '25', '50', '100', '250'];
const RADIUS_KEY = 'hush_search_radius';
function readRadius(): string | null {
  try { return localStorage.getItem(RADIUS_KEY); } catch { return null; }
}
function storeRadius(v: string) {
  try { localStorage.setItem(RADIUS_KEY, v); } catch { /* storage unavailable */ }
}

// "Show me" — narrows results further. Everyone listed already wants to meet you too.
const SHOW_OPTIONS = [
  { value: 'WOMAN', label: 'Women' },
  { value: 'MAN', label: 'Men' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'COUPLE', label: 'Couples' },
];
const COUPLE_TYPES = ['MF', 'FF', 'MM', 'MX'];
const ADV_KEYS = ['heightMin', 'heightMax', 'bodyType', 'intentions', 'languages', 'verified', 'photos', 'active'] as const;
// Most-spoken languages first; the rest are a tap away in the profile itself.
const QUICK_LANGUAGES = LANGUAGE_OPTIONS.slice(0, 10);

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' });
}

function countryOf(city: string, fallback: string): string {
  if (!city) return fallback;
  if ((CITIES_BY_COUNTRY[fallback] ?? []).includes(city)) return fallback;
  return COUNTRIES.find((c) => (CITIES_BY_COUNTRY[c] ?? []).includes(city)) ?? fallback;
}

function list(v: string | undefined): string[] {
  return (v ?? '').split(',').filter(Boolean);
}

export default function MembersContent({
  members, total, searchParams, canChangeCity, profileCountry, callerHasLocation = false,
  advancedFilters = false, travel = null, canTravel = false, spotlight = [],
  radiusKm = null, maxRadiusKm = 250, sort: appliedSort = 'active', unknownDistance = 0, homeLat = null, homeLng = null,
  inRadius, furtherAway = 0,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const { data: session } = useSession();
  const watermark = (session?.user as { username?: string })?.username ?? session?.user?.email ?? 'unbound';

  const [ageMin, setAgeMin] = useState(searchParams.ageMin || '18');
  const [ageMax, setAgeMax] = useState(searchParams.ageMax || '65');
  const initialCity = canChangeCity ? (searchParams.city || '') : '';
  const [city, setCity] = useState(initialCity);
  const [country, setCountry] = useState(countryOf(initialCity, profileCountry || ''));
  const initialShow = (searchParams.show ?? (searchParams.gender && searchParams.gender !== 'ALL' ? searchParams.gender : ''))
    .split(',').filter(Boolean);
  const [show, setShow] = useState<string[]>(initialShow);
  const [coupleTypes, setCoupleTypes] = useState<string[]>((searchParams.coupleType ?? '').split(',').filter(Boolean));
  const [onlineOnly, setOnlineOnly] = useState(searchParams.online === '1');
  const [sortBy, setSortBy] = useState<string>(appliedSort);
  const anywhereAllowed = maxRadiusKm === null;
  const initialRadius = searchParams.radius ?? (radiusKm === null ? (callerHasLocation && anywhereAllowed ? 'any' : '50') : String(radiusKm));
  const [radius, setRadius] = useState<string>(initialRadius);

  // Advanced (Gold+)
  const [heightMin, setHeightMin] = useState(searchParams.heightMin || '');
  const [heightMax, setHeightMax] = useState(searchParams.heightMax || '');
  const [bodyTypes, setBodyTypes] = useState<string[]>(list(searchParams.bodyType));
  const [intentions, setIntentions] = useState<string[]>(list(searchParams.intentions));
  const [languages, setLanguages] = useState<string[]>(list(searchParams.languages));
  const [verified, setVerified] = useState(searchParams.verified === '1');
  const [photos, setPhotos] = useState(searchParams.photos === '1');
  const [active, setActive] = useState(searchParams.active === '1');
  const advancedCount = advancedFilters ? ADV_KEYS.filter((k) => searchParams[k]).length : 0;
  const [showAdvanced, setShowAdvanced] = useState(advancedCount > 0);
  const [nudge, setNudge] = useState<null | 'filters' | 'city' | 'radius'>(null);

  // Remember the member's radius between visits (per browser).
  useEffect(() => {
    if (searchParams.radius || !callerHasLocation) return;
    const saved = readRadius();
    if (!saved || saved === initialRadius) return;
    if (saved === 'any' && !anywhereAllowed) return;
    if (saved !== 'any' && !RADII.includes(saved)) return;
    setRadius(saved);
    applyFilters({ radius: saved });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableCities = country ? (CITIES_BY_COUNTRY[country] ?? []) : [];

  function applyFilters(overrides?: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const sh = overrides && 'show' in overrides ? overrides.show : show.join(',');
    const ct = overrides && 'coupleType' in overrides ? overrides.coupleType : coupleTypes.join(',');
    const om = overrides?.online ?? (onlineOnly ? '1' : undefined);
    const s = overrides?.sort ?? sortBy;
    const rad = overrides && 'radius' in overrides ? overrides.radius : radius;
    const c = canChangeCity ? city : '';
    if (sh) params.set('show', sh);
    if (sh?.split(',').includes('COUPLE') && ct) params.set('coupleType', ct);
    if (ageMin !== '18') params.set('ageMin', ageMin);
    if (ageMax !== '65') params.set('ageMax', ageMax);
    if (c.trim()) params.set('city', c.trim());
    // Travellers browse their destination by default; "All cities" must say so.
    else if (canChangeCity && travel) params.set('anyCity', '1');
    if (om === '1') params.set('online', '1');
    // Keep the default ordering unless a sort was actually chosen
    if (s && (overrides?.sort || searchParams.sort)) params.set('sort', s);
    if (rad && callerHasLocation) params.set('radius', rad);
    if (advancedFilters) {
      if (heightMin) params.set('heightMin', heightMin);
      if (heightMax) params.set('heightMax', heightMax);
      if (bodyTypes.length) params.set('bodyType', bodyTypes.join(','));
      if (intentions.length) params.set('intentions', intentions.join(','));
      if (languages.length) params.set('languages', languages.join(','));
      if (verified) params.set('verified', '1');
      if (photos) params.set('photos', '1');
      if (active) params.set('active', '1');
    }
    params.set('page', '1');
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function toggle(listState: string[], set: (v: string[]) => void, value: string) {
    set(listState.includes(value) ? listState.filter((v) => v !== value) : [...listState, value]);
  }

  // Locked controls stay visible (that's what sells the upgrade); tapping one opens the nudge.
  // (aria-disabled rather than disabled, so the tap still reaches the nudge handler)
  const lockProps = advancedFilters ? {} : { 'aria-disabled': true as const, tabIndex: -1 };
  const lockInput = advancedFilters ? {} : { 'aria-disabled': true as const, tabIndex: -1, readOnly: true };
  const chip = (on: boolean) => `min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium transition-all ${on ? 'bg-[#DC143C] text-white' : 'glass text-white/70 hover:text-white'}`;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Travel pill */}
      {travel ? (
        <Link
          href="/account#travel"
          className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1.5 text-xs sm:text-sm text-sky-100 hover:bg-sky-400/15 mb-5 max-w-full"
        >
          <Plane size={13} aria-hidden="true" className="flex-shrink-0" />
          <span className="truncate">Exploring {travel.city} until {shortDate(travel.until)}</span>
          <span className="text-sky-200/70 flex-shrink-0">· Change</span>
        </Link>
      ) : canTravel ? (
        <Link href="/account#travel" className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-xs mb-5">
          <Plane size={12} aria-hidden="true" /> Travelling soon? Turn on travel mode
        </Link>
      ) : null}

      {!travel && <LocationPrompt hasLocation={callerHasLocation} lat={homeLat} lng={homeLng} className="mb-6" />}

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4 items-start sm:items-center flex-wrap">
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

          {/* Search radius from the member's location (Anywhere = Gold+) */}
          {!callerHasLocation ? (
            <span className="flex items-center gap-1.5 glass px-3 py-1.5 rounded-lg text-sm text-white/60" title={travel ? 'Distance search is paused while you travel' : 'Turn on location to search by distance'}>
              <Navigation size={12} aria-hidden="true" /> {travel ? `In ${travel.city}` : 'Everywhere · location off'}
            </span>
          ) : (
          <div className="flex items-center gap-2">
            <Navigation size={12} className="text-white/55" aria-hidden="true" />
            <select
              value={radius}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'any' && !anywhereAllowed) { setNudge('radius'); return; }
                setRadius(v); storeRadius(v); applyFilters({ radius: v });
              }}
              className="input-dark px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
              aria-label="Search radius"
              title="How far to look"
            >
              {RADII.filter((r) => maxRadiusKm === null || Number(r) <= maxRadiusKm).map((r) => (
                <option key={r} value={r}>Within {r} km</option>
              ))}
              <option value="any">{anywhereAllowed ? 'Anywhere' : 'Anywhere · Gold'}</option>
            </select>
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
            <span className="text-white/70 text-sm">Online now</span>
          </label>

          <button
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            aria-controls="advanced-filters"
            className="flex items-center gap-1.5 glass px-3 py-1.5 rounded-lg text-sm text-white/80 hover:text-white"
          >
            <SlidersHorizontal size={13} aria-hidden="true" />
            More filters
            {advancedCount > 0 && <span className="bg-[#DC143C] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{advancedCount}</span>}
            {!advancedFilters && <PlanChip tier="GOLD" locked={false} />}
            <ChevronDown size={13} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>

          <button
            onClick={() => applyFilters()}
            className="bg-[#DC143C] hover:bg-[#FF1744] text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Advanced filters (Gold+). Free members see them locked. Never filters by ethnicity. */}
      {showAdvanced && (
        <div id="advanced-filters" className="relative glass rounded-2xl p-4 sm:p-5 mb-6 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-white text-sm font-semibold">Advanced filters</h2>
            {!advancedFilters && <PlanChip tier="GOLD" />}
          </div>
          <div
            className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-4 ${advancedFilters ? '' : 'opacity-55 select-none'}`}
            onClickCapture={advancedFilters ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); setNudge('filters'); }}
          >
            <fieldset>
              <legend className="text-white/60 text-xs mb-2">Height (cm)</legend>
              <div className="flex items-center gap-2">
                <input type="number" min={120} max={230} placeholder="Min" value={heightMin} onChange={(e) => setHeightMin(e.target.value)} className="input-dark w-20 px-2 py-1.5 rounded-lg text-sm text-center" aria-label="Minimum height in cm" {...lockInput} />
                <span className="text-white/55">–</span>
                <input type="number" min={120} max={230} placeholder="Max" value={heightMax} onChange={(e) => setHeightMax(e.target.value)} className="input-dark w-20 px-2 py-1.5 rounded-lg text-sm text-center" aria-label="Maximum height in cm" {...lockInput} />
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-white/60 text-xs mb-2">Body type</legend>
              <div className="flex flex-wrap gap-1.5">
                {BODY_TYPE_OPTIONS.map((o) => (
                  <button key={o.value} type="button" aria-pressed={bodyTypes.includes(o.value)} onClick={() => toggle(bodyTypes, setBodyTypes, o.value)} className={chip(bodyTypes.includes(o.value))} {...lockProps}>{o.label}</button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-white/60 text-xs mb-2">Looking for</legend>
              <div className="flex flex-wrap gap-1.5">
                {INTENTION_OPTIONS.map((o) => (
                  <button key={o.value} type="button" aria-pressed={intentions.includes(o.value)} onClick={() => toggle(intentions, setIntentions, o.value)} className={chip(intentions.includes(o.value))} {...lockProps}>{o.label}</button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-white/60 text-xs mb-2">Speaks</legend>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_LANGUAGES.map((l) => (
                  <button key={l} type="button" aria-pressed={languages.includes(l)} onClick={() => toggle(languages, setLanguages, l)} className={chip(languages.includes(l))} {...lockProps}>{l}</button>
                ))}
              </div>
            </fieldset>
          </div>
          <fieldset className="mt-5">
            <legend className="text-white/60 text-xs mb-2 flex items-center gap-2">City {!canChangeCity && <PlanChip tier="GOLD" locked={false} />}</legend>
            {canChangeCity ? (
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={country}
                  onChange={(e) => { setCountry(e.target.value); setCity(''); }}
                  className="input-dark px-3 py-1.5 rounded-lg text-sm max-w-[11rem]"
                  aria-label="Filter by country"
                >
                  <option value="">Any country</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="input-dark px-3 py-1.5 rounded-lg text-sm max-w-[11rem]"
                  aria-label="Filter by city"
                  disabled={!country}
                >
                  <option value="">Any city</option>
                  {availableCities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="text-white/45 text-xs">Overrides the radius — handy before a trip.</span>
              </div>
            ) : (
              <button type="button" onClick={() => setNudge('city')} className="flex items-center gap-2 glass px-3 py-1.5 rounded-lg hover:bg-white/10 text-white/60 text-sm">
                <Lock size={12} aria-hidden="true" /> Search a specific city
              </button>
            )}
          </fieldset>
          <div
            className={`flex flex-wrap gap-x-6 gap-y-3 mt-5 pt-4 border-t border-white/5 ${advancedFilters ? '' : 'opacity-55 select-none'}`}
            onClickCapture={advancedFilters ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); setNudge('filters'); }}
          >
            {[
              { label: 'Verified only', on: verified, set: setVerified },
              { label: 'Has photos', on: photos, set: setPhotos },
              { label: 'Active this week', on: active, set: setActive },
            ].map(({ label, on, set }) => (
              <label key={label} className="flex items-center gap-2 cursor-pointer text-white/75 text-sm">
                <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="w-4 h-4 accent-[#DC143C]" {...lockProps} />
                {label}
              </label>
            ))}
            {advancedFilters ? (
              <div className="flex gap-2 ml-auto">
                {advancedCount > 0 && (
                  <button
                    onClick={() => { setHeightMin(''); setHeightMax(''); setBodyTypes([]); setIntentions([]); setLanguages([]); setVerified(false); setPhotos(false); setActive(false); }}
                    className="text-white/55 hover:text-white text-sm"
                  >
                    Reset
                  </button>
                )}
                <button onClick={() => applyFilters()} className="bg-[#DC143C] hover:bg-[#FF1744] text-white px-4 py-1.5 rounded-lg text-sm font-semibold">Apply filters</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNudge('filters')}
                className="ml-auto inline-flex items-center gap-1.5 text-[#D4AF37] text-sm font-medium hover:underline opacity-100"
              >
                <Lock size={12} aria-hidden="true" /> Unlock with Gold
              </button>
            )}
          </div>
          {!advancedFilters && (
            <p className="text-white/45 text-[11px] mt-4">We never filter or rank by ethnicity.</p>
          )}
        </div>
      )}

      {nudge && (
        <UpgradeNudge
          key={nudge}
          takeover
          className="mb-6"
          feature={nudge === 'filters' ? 'advanced-filters' : 'search-anywhere'}
          title={nudge === 'filters' ? 'Find exactly who you’re looking for' : 'Meet people beyond 250 km'}
          body={nudge === 'filters'
            ? 'Gold adds height, body type, intentions, languages, verified-only, has-photos and active-this-week filters.'
            : 'Gold lets you search anywhere, pick a specific city and turn on travel mode before a trip.'}
          tier="GOLD"
          onDismiss={() => setNudge(null)}
        />
      )}

      {/* Platinum spotlight */}
      {spotlight.length > 0 && (
        <section aria-labelledby="spotlight-title" className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 id="spotlight-title" className="flex items-center gap-1.5 text-white text-sm font-semibold">
              <Sparkles size={14} className="text-[#D4AF37]" aria-hidden="true" />
              Spotlight
              <span className="text-white/50 font-normal text-xs">· Platinum members active now</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:max-w-4xl">
            {spotlight.map((m) => <MemberTile key={m.id ?? m.username} member={m} watermark={watermark} />)}
          </div>
        </section>
      )}

      {radiusKm !== null && !searchParams.city && (inRadius ?? 0) < 12 && (maxRadiusKm === null || radiusKm < maxRadiusKm) && (
        <div role="note" className="glass rounded-2xl px-4 py-3 mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border border-white/10">
          <p className="text-white/80 text-sm flex-1 min-w-[14rem]">
            {(inRadius ?? 0) === 0 ? `No one within ${radiusKm} km yet` : `Only ${inRadius} ${inRadius === 1 ? 'person' : 'people'} within ${radiusKm} km`}
            {furtherAway > 0 ? ' — showing more further away.' : ' — try a wider search.'}
          </p>
          <div className="flex gap-2">
            {radiusKm < 250 && (maxRadiusKm === null || maxRadiusKm >= 250) && (
              <button type="button" onClick={() => { setRadius('250'); storeRadius('250'); applyFilters({ radius: '250' }); }} className="glass border border-white/15 hover:border-white/30 text-white/85 px-3 py-1.5 rounded-lg text-xs font-semibold">Widen to 250 km</button>
            )}
            {anywhereAllowed ? (
              <button type="button" onClick={() => { setRadius('any'); storeRadius('any'); applyFilters({ radius: 'any' }); }} className="bg-[#DC143C] hover:bg-[#FF1744] text-white px-3 py-1.5 rounded-lg text-xs font-semibold">Anywhere</button>
            ) : (
              <button type="button" onClick={() => setNudge('radius')} className="text-[#D4AF37] hover:underline px-1 py-1.5 text-xs font-semibold">Anywhere (Gold)</button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p className="text-white/65 text-sm">
          <span className="text-white">{total.toLocaleString()}</span> member{total === 1 ? '' : 's'}
          {searchParams.city
            ? <> in <span className="text-white">{searchParams.city}</span></>
            : radiusKm !== null
              ? <> · <span className="text-white">{(inRadius ?? total - unknownDistance - furtherAway).toLocaleString()}</span> within {radiusKm} km{unknownDistance > 0 && <span className="text-white/50"> · {unknownDistance} with distance unknown</span>}{furtherAway > 0 && <span className="text-white/50"> · {furtherAway} further away</span>}</>
              : !callerHasLocation && !travel
                ? <span className="text-white/50"> · turn on location to sort by distance</span>
                : null}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-white/55 text-xs mr-1">Sort:</span>
          {[
            ...(callerHasLocation ? [{ value: 'nearest', label: 'Nearest' }] : []),
            { value: 'active', label: 'Recently active' },
            { value: 'new', label: 'Newest' },
            { value: 'match', label: 'Best match' },
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
            We only show people who&apos;d like to meet you too. Unbound is new and growing every week — try widening your filters, or check who you&apos;d like to meet on your profile.
          </p>
          <button
            onClick={() => { setShow([]); setCoupleTypes([]); setCity(''); setCountry(''); setOnlineOnly(false); router.push(`${pathname}${callerHasLocation && anywhereAllowed ? '?radius=any' : callerHasLocation ? '?radius=250' : ''}`); }}
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
            city: canChangeCity ? searchParams.city : undefined,
            online: searchParams.online,
            // The sort as requested (not as applied): the default ordering differs
            // slightly from an explicit one (review trust nudge), keep pages consistent.
            sort: searchParams.sort,
            radius: callerHasLocation ? (searchParams.radius ?? (radiusKm === null ? 'any' : String(radiusKm))) : undefined,
            anyCity: searchParams.anyCity,
            ...(advancedFilters ? Object.fromEntries(ADV_KEYS.map((k) => [k, searchParams[k]])) : {}),
          }}
        />
      )}
    </div>
  );
}

