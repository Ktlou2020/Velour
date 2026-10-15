'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import EmptyState from '@/components/EmptyState';
import MatchOverlay from '@/components/MatchOverlay';
import ProtectedImage from '@/components/ProtectedImage';
import { useSession } from 'next-auth/react';
import { X, Heart, Star, MapPin, Zap, Navigation, Sparkles, Undo2, Crown, Lock, Quote, Plane, MessageCircle, Moon } from 'lucide-react';
import AllowanceMeter, { resetPhrase, type Allowance } from '@/components/plans/AllowanceMeter';
import UpgradeNudge from '@/components/plans/UpgradeNudge';
import StatusPill from '@/components/status/StatusPill';
import SparkCard from '@/components/spark/SparkCard';
import LocationPrompt from '@/components/plans/LocationPrompt';
import { RatingChip } from '@/components/reviews/Stars';

function savedRadius(): string | null {
  try { return localStorage.getItem('hush_search_radius'); } catch { return null; }
}

interface Profile {
  id?: string;
  username: string;
  displayName?: string;
  age?: number;
  city?: string;
  country?: string;
  bio?: string;
  interests?: string[];
  profilePhotoUrl?: string;
  isOnline?: boolean;
  membershipTier?: string;
  isBoosted?: boolean;
  compatibility?: number;
  compatibilityReasons?: string[];
  distance?: string;
  prompts?: { question: string; answer: string }[];
  pronouns?: string;
  isCouple?: boolean;
  coupleBadge?: string;
  ages?: number[];
  status?: { text: string; emoji?: string };
  visiting?: { city: string; until: string };
  isSpotlight?: boolean;
  rating?: { avg: number; count: number };
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' });
}

function agesText(p: Profile): string | undefined {
  if (p.isCouple && p.ages?.length) return p.ages.join(' & ');
  return p.age ? String(p.age) : undefined;
}

type ActionType = 'LIKE' | 'SUPER_LIKE' | 'WINK' | 'PASS';
type AnimDir = 'left' | 'right' | 'up' | null;

export default function DiscoverPage() {
  const { data: session } = useSession();
  const watermark = (session?.user as { username?: string })?.username ?? session?.user?.email ?? 'hush';
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [animDir, setAnimDir] = useState<AnimDir>(null);
  const [matchProfile, setMatchProfile] = useState<Profile | null>(null);
  const [dragHint, setDragHint] = useState<'PASS' | 'LIKE' | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const [undoStack, setUndoStack] = useState<Profile[]>([]);
  const [isPaid, setIsPaid] = useState(false);
  const [picks, setPicks] = useState<Profile[]>([]);
  const [picksLimit, setPicksLimit] = useState(5);
  const [actedIds, setActedIds] = useState<Set<string>>(new Set());
  const [nudge, setNudge] = useState<'undo' | 'superlike' | null>(null);
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [nextTierPicks, setNextTierPicks] = useState<number | null>(null);
  const [travel, setTravel] = useState<{ city: string; until: string } | null>(null);
  const [hasLocation, setHasLocation] = useState(true);
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const actionInProgress = useRef(false);
  const pendingAction = useRef<Promise<unknown> | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);
  const indexRef = useRef(0);
  useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);

  useEffect(() => {
    loadProfiles(true);
    loadPicks();
    loadAllowance();
  }, []);

  async function loadAllowance() {
    try {
      const res = await fetch('/api/likes/allowance');
      if (res.ok) setAllowance(await res.json() as Allowance);
    } catch { /* ignore */ }
  }

  const canUndo = allowance ? allowance.features.undoSwipe : isPaid;
  const outOfLikes = !!allowance && allowance.likes.limit !== null && (allowance.likes.remaining ?? 0) <= 0;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadPicks() {
    try {
      const res = await fetch('/api/picks');
      if (res.ok) {
        const data = await res.json() as { picks?: Profile[]; limit?: number; isPaid?: boolean; nextTierPicks?: number | null; travel?: { city: string; until: string } | null };
        setPicks(data.picks || []);
        if (data.limit) setPicksLimit(data.limit);
        setIsPaid(!!data.isPaid);
        setNextTierPicks(data.nextTierPicks ?? null);
        setTravel(data.travel ?? null);
      }
    } catch { /* ignore */ }
  }

  // Bring a pick to the top of the deck
  function showPick(pick: Profile) {
    if (actionInProgress.current) return;
    setProfiles(prev => {
      const before = prev.slice(0, currentIndex);
      const after = prev.slice(currentIndex).filter(p => p.id !== pick.id);
      return [...before, pick, ...after];
    });
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') doAction('PASS', 'left');
      if (e.key === 'ArrowRight') doAction('LIKE', 'right');
      if (e.key === 'ArrowUp') doAction('SUPER_LIKE', 'up');
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, currentIndex]);

  async function loadProfiles(withSpotlight = false) {
    setLoading(true);
    try {
      const [res, spot] = await Promise.all([
        fetch(`/api/members?limit=10&discover=1${(() => { const r = savedRadius(); return r ? `&radius=${encodeURIComponent(r)}` : ''; })()}`),
        withSpotlight ? fetch('/api/members/spotlight?discover=1&limit=1').catch(() => null) : Promise.resolve(null),
      ]);
      if (res.ok) {
        const data = await res.json();
        let list: Profile[] = data.members || data || [];
        setHasLocation(data.callerHasLocation !== false);
        setRadiusKm(typeof data.radiusKm === 'number' ? data.radiusKm : null);
        // Platinum spotlight takes the first slot of a fresh deck
        if (spot?.ok) {
          const s = await spot.json() as { members?: Profile[] };
          const featured = s.members?.[0];
          if (featured) list = [featured, ...list.filter((p) => p.id !== featured.id)];
        }
        setProfiles(list);
        setCurrentIndex(0);
      }
    } finally {
      setLoading(false);
    }
  }

  // Put a card back on top of the deck (after the server refused the like).
  // Runs after the swipe animation so the deck index has settled.
  function restoreCard(profile: Profile) {
    setTimeout(() => {
      setProfiles(prev => {
        const was = prev.findIndex(p => p.id === profile.id);
        const rest = prev.filter(p => p.id !== profile.id);
        const at = Math.max(0, Math.min(rest.length, was !== -1 && was < indexRef.current ? indexRef.current - 1 : indexRef.current));
        setCurrentIndex(at);
        return [...rest.slice(0, at), profile, ...rest.slice(at)];
      });
      if (profile.id) setActedIds(prev => { const n = new Set(prev); n.delete(profile.id!); return n; });
      setUndoStack(prev => prev.filter(p => p.id !== profile.id));
    }, 340);
  }

  async function doAction(type: ActionType, dir: AnimDir) {
    if (actionInProgress.current) return;
    const profile = profiles[currentIndex];
    if (!profile) return;
    // Out of likes: the end-of-likes card is showing; passes still work.
    if (outOfLikes && (type === 'LIKE' || type === 'WINK')) return;
    if (type === 'SUPER_LIKE' && allowance && allowance.superLikes.available <= 0) {
      setToast(`No super likes left ${allowance.superLikes.period === 'day' ? 'today' : 'this week'} — they refresh ${resetPhrase(allowance.superLikes.resetsAt)}.`);
      if (allowance.tier !== 'PLATINUM') setNudge('superlike');
      return;
    }

    actionInProgress.current = true;
    setAnimDir(dir);
    setDragDelta(0);
    setDragHint(null);

    // Keep undo stack (last 3)
    setUndoStack(prev => [profile, ...prev].slice(0, 3));

    if (profile.id) setActedIds(prev => new Set(prev).add(profile.id!));

    const request = (async () => {
      try {
        const res = await fetch('/api/likes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toUserId: profile.id, type }),
        });
        const data = await res.json().catch(() => ({})) as { matched?: boolean; allowance?: Allowance; code?: string; error?: string };
        if (data.allowance) setAllowance(data.allowance);
        if (res.ok && type !== 'PASS' && data.matched) {
          setTimeout(() => setMatchProfile(profile), 350);
        }
        if (res.status === 429) {
          // Allowance ran out server-side: give the card back.
          restoreCard(profile);
          if (data.code === 'SUPERLIKE_LIMIT') {
            setToast(data.error || 'No super likes left right now');
            if (data.allowance?.tier !== 'PLATINUM') setNudge('superlike');
          }
        }
      } catch { /* ignore */ }
    })();
    pendingAction.current = request;

    setTimeout(() => {
      setCurrentIndex((i) => {
        const next = i + 1;
        if (next >= profiles.length - 2) loadProfiles();
        return next;
      });
      setAnimDir(null);
      actionInProgress.current = false;
    }, 300);
  }

  async function handleUndo() {
    if (!canUndo) { setNudge('undo'); return; }
    if (undoing || actionInProgress.current) return;
    setUndoing(true);
    try {
      // Make sure the swipe we're undoing has reached the server
      if (pendingAction.current) await pendingAction.current;
      const res = await fetch('/api/likes/undo', { method: 'POST' });
      const data = await res.json().catch(() => ({})) as { userId?: string; unmatched?: boolean; error?: string; upgrade?: boolean };
      if (!res.ok) {
        if (data.upgrade) { setIsPaid(false); setNudge('undo'); }
        else setToast(data.error || 'Could not undo that swipe');
        return;
      }
      const restored = undoStack.find(p => p.id === data.userId);
      setUndoStack(prev => prev.filter(p => p.id !== data.userId));
      if (data.userId) setActedIds(prev => { const n = new Set(prev); n.delete(data.userId!); return n; });
      if (data.unmatched) { setMatchProfile(null); setToast('Swipe undone — match removed'); }
      loadAllowance();
      if (restored) {
        // Put the card back on top of the deck
        setProfiles(prev => {
          const before = prev.slice(0, currentIndex);
          const after = prev.slice(currentIndex).filter(p => p.id !== restored.id);
          return [...before, restored, ...after];
        });
      } else {
        await loadProfiles();
      }
    } catch {
      setToast('Could not undo that swipe');
    } finally {
      setUndoing(false);
    }
  }

  // Shared drag/touch helpers
  function onDragStart(x: number, y: number) {
    dragStartX.current = x;
    dragStartY.current = y;
  }

  function onDragMove(x: number) {
    if (dragStartX.current === null) return;
    const delta = x - dragStartX.current;
    setDragDelta(delta);
    if (delta > 50) setDragHint('LIKE');
    else if (delta < -50) setDragHint('PASS');
    else setDragHint(null);
  }

  function onDragEnd(x: number) {
    if (dragStartX.current === null) return;
    const delta = x - dragStartX.current;
    dragStartX.current = null;
    dragStartY.current = null;
    setDragDelta(0);
    setDragHint(null);
    if (delta > 80) doAction('LIKE', 'right');
    else if (delta < -80) doAction('PASS', 'left');
  }

  const remaining = profiles.slice(currentIndex);
  const current = remaining[0];

  const initials = current ? (current.displayName || current.username || '??').slice(0, 2).toUpperCase() : '';
  const location = current ? [current.city, current.country].filter(Boolean).join(', ') : '';

  const cardTransform = animDir === 'left'
    ? 'translate(-150%) rotate(-20deg) opacity-0'
    : animDir === 'right'
    ? 'translate(150%) rotate(20deg) opacity-0'
    : animDir === 'up'
    ? 'translateY(-150%) opacity-0'
    : '';

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />

      <main className="pt-16 min-h-screen flex flex-col">
        {/* Header Bar */}
        <div className="glass-dark border-b border-white/5 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="font-serif text-white text-xl font-bold">Discover</h1>
              <p className="text-white/60 text-xs">{remaining.length} profile{remaining.length !== 1 ? 's' : ''} to discover</p>
            </div>
            {travel && (
              <Link href="/account#travel" className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1 text-xs text-sky-100 hover:bg-sky-400/15">
                <Plane size={12} aria-hidden="true" />
                Exploring {travel.city} until {shortDate(travel.until)} <span className="text-sky-200/70">· Change</span>
              </Link>
            )}
          </div>
          <div className="max-w-4xl mx-auto mt-2">
            <AllowanceMeter allowance={allowance} />
          </div>
          {!travel && !hasLocation && (
            <div className="max-w-4xl mx-auto mt-3">
              <LocationPrompt hasLocation={false} onSaved={() => { loadProfiles(true); loadPicks(); }} />
            </div>
          )}
        </div>

        {/* Today's picks */}
        {picks.length > 0 && (
          <div className="border-b border-white/5 px-4 py-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-1.5 text-white text-sm font-semibold">
                  <Sparkles size={14} className="text-[#D4AF37]" />
                  Today&apos;s picks
                  <span className="text-white/55 font-normal text-xs">· {picks.length} of {picksLimit}</span>
                </h2>
                {nextTierPicks && (
                  <Link href="/upgrade#compare" className="flex items-center gap-1 text-[#D4AF37] text-xs font-medium hover:underline">
                    <Crown size={11} />
                    Get {nextTierPicks} daily picks
                  </Link>
                )}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                {picks.map((pick) => {
                  const acted = pick.id ? actedIds.has(pick.id) : false;
                  const pickInitials = (pick.displayName || pick.username || '?').slice(0, 2).toUpperCase();
                  return (
                    <button
                      key={pick.id ?? pick.username}
                      onClick={() => !acted && showPick(pick)}
                      disabled={acted}
                      className={`shrink-0 w-24 text-left group ${acted ? 'opacity-35 cursor-default' : ''}`}
                      aria-label={`Show ${pick.displayName || pick.username}`}
                    >
                      <div className="relative w-24 h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-rose-950 to-[#0A0A0F] flex items-center justify-center border border-white/10 group-hover:border-[#D4AF37]/50 transition-colors">
                        {pick.profilePhotoUrl ? (
                          <ProtectedImage src={pick.profilePhotoUrl} alt={pick.username} className="w-full h-full" watermark={watermark} />
                        ) : (
                          <span className="text-white/60 text-2xl font-bold font-serif">{pickInitials}</span>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                        {typeof pick.compatibility === 'number' && (
                          <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold text-[#D4AF37]">
                            {pick.compatibility}%
                          </span>
                        )}
                        <RatingChip rating={pick.rating} className="absolute top-1.5 left-1.5 !px-1 !py-0.5" />
                        {acted && (
                          <span className="absolute inset-0 flex items-center justify-center text-white/80 text-[10px] font-semibold">Seen</span>
                        )}
                      </div>
                      <p className="text-white/80 text-xs font-medium truncate mt-1.5">
                        {pick.displayName || pick.username}{agesText(pick) ? <span className="text-white/60">, {agesText(pick)}</span> : null}
                      </p>
                      {pick.distance && <p className="text-white/55 text-[10px] truncate">{pick.distance}</p>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Card Area */}
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          {loading ? (
            <div className="w-full max-w-sm" aria-busy="true">
              <span className="sr-only">Finding people for you…</span>
              <div className="rounded-3xl overflow-hidden glass">
                <div className="aspect-[3/4] skeleton" />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-1/2 rounded skeleton" />
                  <div className="h-3 w-full rounded skeleton" />
                  <div className="h-3 w-4/5 rounded skeleton" />
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-8">
                {[64, 56, 64, 56].map((d, i) => <div key={i} className="rounded-full skeleton" style={{ width: d, height: d }} />)}
              </div>
            </div>
          ) : outOfLikes && current ? (
            <div className="w-full max-w-sm text-center">
              <div className="glass rounded-3xl p-7 sm:p-8 border border-white/10 relative overflow-hidden">
                <div aria-hidden="true" className="absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full bg-[#DC143C]/15 blur-3xl" />
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#DC143C]/25 to-[#D4AF37]/15 border border-white/10 flex items-center justify-center mx-auto mb-5">
                    <Moon size={26} className="text-[#FFB3C1]" aria-hidden="true" />
                  </div>
                  <h2 className="font-serif text-white text-2xl font-bold mb-2">That&apos;s a lot of love for one day</h2>
                  <p className="text-white/70 text-sm leading-relaxed mb-6">
                    You&apos;ve used today&apos;s {allowance?.likes.limit} likes — they refresh at midnight.
                    Meanwhile, here are some lovely ways to keep the spark going.
                  </p>
                  <SparkCard className="mb-2 text-left" />
                  <div className="grid gap-2 text-left">
                    <Link href="/matches" className="flex items-center gap-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-[#DC143C]/40 px-4 py-3 transition-colors">
                      <MessageCircle size={18} className="text-[#FF4D6D] flex-shrink-0" aria-hidden="true" />
                      <span><span className="block text-white text-sm font-semibold">Check your matches</span><span className="block text-white/55 text-xs">Say hello before a match expires</span></span>
                    </Link>
                    <Link href="/members" className="flex items-center gap-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-white/25 px-4 py-3 transition-colors">
                      <Heart size={18} className="text-white/70 flex-shrink-0" aria-hidden="true" />
                      <span><span className="block text-white text-sm font-semibold">Browse members</span><span className="block text-white/55 text-xs">Read profiles now, like them tomorrow</span></span>
                    </Link>
                  </div>
                </div>
              </div>
              <UpgradeNudge
                className="mt-5 text-left"
                feature="unlimited-likes"
                title="Never run out"
                body="Gold members get unlimited likes, see who already liked them, and can rewind a swipe."
                tier="GOLD"
              />
            </div>
          ) : current ? (
            <div className="w-full max-w-sm">

              {/* Card Stack */}
              <div className="relative">
                {/* Third card */}
                {remaining[2] && (
                  <div
                    className="absolute inset-0 glass rounded-3xl"
                    style={{ transform: 'scale(0.90) translateY(16px)', zIndex: -2, opacity: 0.5 }}
                  />
                )}
                {/* Second card */}
                {remaining[1] && (
                  <div
                    className="absolute inset-0 glass rounded-3xl"
                    style={{ transform: 'scale(0.95) translateY(8px)', zIndex: -1, opacity: 0.75 }}
                  />
                )}

                {/* Main Card */}
                <div
                  className="relative glass rounded-3xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing select-none"
                  style={{
                    zIndex: 1,
                    transform: animDir
                      ? cardTransform
                      : dragDelta !== 0
                        ? `translateX(${dragDelta}px) rotate(${dragDelta * 0.05}deg)`
                        : undefined,
                    opacity: animDir ? 0 : 1,
                    transition: dragDelta !== 0 ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
                  }}
                  onMouseDown={(e) => onDragStart(e.clientX, e.clientY)}
                  onMouseMove={(e) => onDragMove(e.clientX)}
                  onMouseUp={(e) => onDragEnd(e.clientX)}
                  onMouseLeave={() => { dragStartX.current = null; setDragDelta(0); setDragHint(null); }}
                  onTouchStart={(e) => onDragStart(e.touches[0].clientX, e.touches[0].clientY)}
                  onTouchMove={(e) => { e.preventDefault(); onDragMove(e.touches[0].clientX); }}
                  onTouchEnd={(e) => onDragEnd(e.changedTouches[0].clientX)}
                >
                  {/* Photo Area */}
                  <div className="h-[min(24rem,50vh)] flex items-center justify-center relative bg-gradient-to-br from-rose-900 via-red-900 to-[#0A0A0F] overflow-hidden">
                    {current.profilePhotoUrl ? (
                      <ProtectedImage src={current.profilePhotoUrl} alt={current.username} className="w-full h-full" watermark={watermark} loading="eager" />
                    ) : (
                      <span className="text-white text-8xl font-bold font-serif opacity-60">{initials}</span>
                    )}

                    {/* Drag hint overlays */}
                    {dragHint === 'LIKE' && (
                      <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center pointer-events-none">
                        <span className="text-emerald-400 font-black text-4xl tracking-widest border-4 border-emerald-400 rounded-xl px-4 py-1 rotate-[-15deg]">LIKE</span>
                      </div>
                    )}
                    {dragHint === 'PASS' && (
                      <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center pointer-events-none">
                        <span className="text-red-400 font-black text-4xl tracking-widest border-4 border-red-400 rounded-xl px-4 py-1 rotate-[15deg]">PASS</span>
                      </div>
                    )}

                    {typeof current.compatibility === 'number' && current.compatibility > 0 && (
                      <div className={`absolute top-4 left-4 glass px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                        current.compatibility >= 70 ? 'text-[#D4AF37]' : 'text-white'
                      }`}>
                        <Sparkles size={12} />
                        {current.compatibility}% match
                      </div>
                    )}
                    {(current.isSpotlight || current.isBoosted) && (
                      <div className="absolute top-14 left-4 flex flex-col items-start gap-1.5">
                        {current.isSpotlight && (
                          <div className="bg-gradient-to-r from-purple-600/90 to-[#D4AF37]/80 backdrop-blur-sm px-2.5 py-1 rounded-full text-white text-xs font-bold flex items-center gap-1" title="Platinum spotlight">
                            <Sparkles size={11} aria-hidden="true" />
                            Spotlight
                          </div>
                        )}
                        {current.isBoosted && (
                          <div className="bg-[#DC143C]/80 backdrop-blur-sm px-2.5 py-1 rounded-full text-white text-xs font-bold flex items-center gap-1">
                            <Zap size={11} className="fill-white" />
                            Boosted
                          </div>
                        )}
                      </div>
                    )}

                    {current.isOnline && (
                      <div className="absolute top-4 right-4 flex items-center gap-1.5 glass px-3 py-1.5 rounded-full">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        <span className="text-white text-xs font-medium">Online</span>
                      </div>
                    )}

                    <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 to-transparent" />

                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h2 className="text-white text-2xl font-bold font-serif break-words">
                        {current.displayName || current.username}{agesText(current) ? `, ${agesText(current)}` : ''}
                        {current.pronouns && <span className="text-white/65 text-sm font-sans font-normal ml-2">({current.pronouns})</span>}
                      </h2>
                      {current.rating && <RatingChip rating={current.rating} className="mt-1.5 mr-1.5 !text-[11px] align-middle" />}
                      {current.status && <StatusPill status={{ emoji: current.status.emoji ?? null, text: current.status.text }} size="sm" className="mt-1.5 mr-1.5" />}
                      {current.visiting && (
                        <span className="inline-flex items-center gap-1 mt-1.5 mr-1.5 bg-sky-400/15 border border-sky-300/30 text-sky-100 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                          <Plane size={10} aria-hidden="true" /> Visiting until {shortDate(current.visiting.until)}
                        </span>
                      )}
                      {current.isCouple && (
                        <span className="inline-block mt-1.5 bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] text-[11px] font-bold px-2 py-0.5 rounded-full">
                          {current.coupleBadge ?? 'Couple'}
                        </span>
                      )}
                      {(location || current.distance) && (
                        <div className="flex items-center gap-3 text-white/70 text-sm mt-1 flex-wrap">
                          {location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={12} />
                              {location}
                            </span>
                          )}
                          {current.distance && (
                            <span className="flex items-center gap-1 text-white/60">
                              <Navigation size={11} />
                              {current.distance}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bio + Interests */}
                  <div className="p-5">
                    {current.compatibilityReasons && current.compatibilityReasons.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {current.compatibilityReasons.map((r) => (
                          <span key={r} className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#D4AF37]">
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                    {current.prompts?.[0] && (
                      <div className="mb-4 rounded-2xl bg-white/[0.03] border border-white/10 p-4">
                        <p className="flex items-center gap-1.5 text-white/60 text-[11px] uppercase tracking-wider mb-1">
                          <Quote size={10} />
                          {current.prompts[0].question}
                        </p>
                        <p className="text-white/85 text-sm font-serif leading-relaxed">{current.prompts[0].answer}</p>
                      </div>
                    )}
                    {current.bio && <p className="text-white/70 text-sm leading-relaxed mb-4">{current.bio}</p>}
                    {current.interests && current.interests.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {current.interests.map((interest) => (
                          <span key={interest} className="glass px-2.5 py-1 rounded-full text-white/60 text-xs">{interest}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  onClick={() => doAction('PASS', 'left')}
                  className="w-16 h-16 rounded-full glass border-2 border-red-500/50 hover:border-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  aria-label="Pass"
                >
                  <X className="text-red-400" size={28} />
                </button>

                <button
                  onClick={() => doAction('WINK', null)}
                  className="w-14 h-14 rounded-full glass border-2 border-amber-500/50 hover:border-amber-500 hover:bg-amber-500/10 flex items-center justify-center transition-all hover:scale-110 active:scale-95 text-2xl"
                  aria-label="Wink"
                >
                  <span aria-hidden="true">😉</span>
                </button>

                <button
                  onClick={() => doAction('LIKE', 'right')}
                  className="w-16 h-16 rounded-full bg-[#DC143C] hover:bg-[#FF1744] flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  aria-label="Like"
                >
                  <Heart className="text-white fill-white" size={28} />
                </button>

                <button
                  onClick={() => doAction('SUPER_LIKE', 'up')}
                  className="w-14 h-14 rounded-full glass border-2 border-[#D4AF37]/50 hover:border-[#D4AF37] hover:bg-[#D4AF37]/10 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  aria-label="Super Like"
                >
                  <Star className="text-[#D4AF37]" size={22} />
                </button>
              </div>

              {/* Undo + keyboard hint */}
              <div className="flex items-center justify-center gap-4 mt-4">
                {undoStack.length > 0 && (
                  <button
                    onClick={handleUndo}
                    disabled={undoing}
                    className="flex items-center gap-1.5 glass px-3 py-1.5 rounded-lg text-white/65 hover:text-white text-xs transition-all hover:bg-white/10 disabled:opacity-50"
                    aria-label="Undo last swipe"
                    title={canUndo ? 'Undo your last swipe (within 10 minutes)' : 'Undo is a Gold & Platinum feature'}
                  >
                    {canUndo ? <Undo2 size={12} /> : <Lock size={11} className="text-[#D4AF37]" />}
                    {undoing ? 'Undoing…' : 'Undo'}
                  </button>
                )}
                <p className="hidden md:block text-white/50 text-xs tracking-wide" aria-hidden="true">
                  ← Pass &nbsp;&nbsp; ❤ Like → &nbsp;&nbsp; ↑ Super Like
                </p>
                <p className="md:hidden text-white/45 text-xs">Swipe or tap to decide</p>
              </div>

              {nudge && (
                <UpgradeNudge
                  key={nudge}
                  takeover
                  className="mt-5"
                  feature={nudge === 'undo' ? 'undo-swipe' : 'super-likes'}
                  title={nudge === 'undo' ? 'Changed your mind?' : 'Want more super likes?'}
                  body={nudge === 'undo'
                    ? 'Gold and Platinum members can rewind their last swipe and get that profile back.'
                    : 'Gold includes 5 super likes a week and Platinum 10 — super liked profiles see you first.'}
                  tier="GOLD"
                  onDismiss={() => setNudge(null)}
                />
              )}

            </div>
          ) : (
            <EmptyState
              icon={Zap}
              title="You’re all caught up"
              description={radiusKm !== null
                ? `No one new within ${radiusKm} km right now. Try a bigger radius on Members, or come back tomorrow — new people join every week.`
                : 'We only show people who’d like to meet you too. New members join every week — come back tomorrow, or widen who you’d like to meet on your profile.'}
              action={{ label: radiusKm !== null ? 'Widen my radius' : 'Browse members', href: '/members' }}
              secondaryAction={{ label: 'See my matches', href: '/matches' }}
            />
          )}
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-dark border border-white/10 px-4 py-2.5 rounded-xl text-white/80 text-sm shadow-xl max-w-[90vw] text-center">
          {toast}
        </div>
      )}

      {/* Match Overlay */}
      <MatchOverlay
        show={!!matchProfile}
        matchedUser={{
          name: matchProfile ? (matchProfile.displayName || matchProfile.username) : '',
          photo: matchProfile?.profilePhotoUrl,
          username: matchProfile?.username,
        }}
        onMessage={async () => {
          if (!matchProfile) return;
          try {
            const res = await fetch('/api/conversations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ targetUsername: matchProfile.username }),
            });
            if (res.ok) {
              const data = await res.json() as { conversation?: { id: string } };
              const convId = data.conversation?.id;
              window.location.href = convId ? `/messages?conv=${convId}` : '/messages';
            } else {
              window.location.href = '/messages';
            }
          } catch {
            window.location.href = '/messages';
          }
        }}
        onClose={() => setMatchProfile(null)}
      />
    </div>
  );
}
