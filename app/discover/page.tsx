'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import EmptyState from '@/components/EmptyState';
import MatchOverlay from '@/components/MatchOverlay';
import ProtectedImage from '@/components/ProtectedImage';
import { useSession } from 'next-auth/react';
import { X, Heart, Star, MapPin, Zap, Navigation, Sparkles, Undo2, Crown, Lock, Quote } from 'lucide-react';

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
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const actionInProgress = useRef(false);
  const pendingAction = useRef<Promise<unknown> | null>(null);
  const dragStartX = useRef<number | null>(null);
  const dragStartY = useRef<number | null>(null);

  useEffect(() => {
    loadProfiles();
    loadPicks();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function loadPicks() {
    try {
      const res = await fetch('/api/picks');
      if (res.ok) {
        const data = await res.json() as { picks?: Profile[]; limit?: number; isPaid?: boolean };
        setPicks(data.picks || []);
        if (data.limit) setPicksLimit(data.limit);
        setIsPaid(!!data.isPaid);
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

  async function loadProfiles() {
    setLoading(true);
    try {
      const res = await fetch('/api/members?limit=10&discover=1');
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.members || data || []);
        setCurrentIndex(0);
      }
    } finally {
      setLoading(false);
    }
  }

  async function doAction(type: ActionType, dir: AnimDir) {
    if (actionInProgress.current) return;
    const profile = profiles[currentIndex];
    if (!profile) return;

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
        if (res.ok && type !== 'PASS') {
          const data = await res.json();
          if (data.matched) {
            setTimeout(() => setMatchProfile(profile), 350);
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
    if (!isPaid) { setShowUpgrade(true); return; }
    if (undoing || actionInProgress.current) return;
    setUndoing(true);
    try {
      // Make sure the swipe we're undoing has reached the server
      if (pendingAction.current) await pendingAction.current;
      const res = await fetch('/api/likes/undo', { method: 'POST' });
      const data = await res.json().catch(() => ({})) as { userId?: string; unmatched?: boolean; error?: string; upgrade?: boolean };
      if (!res.ok) {
        if (data.upgrade) { setIsPaid(false); setShowUpgrade(true); }
        else setToast(data.error || 'Could not undo that swipe');
        return;
      }
      const restored = undoStack.find(p => p.id === data.userId);
      setUndoStack(prev => prev.filter(p => p.id !== data.userId));
      if (data.userId) setActedIds(prev => { const n = new Set(prev); n.delete(data.userId!); return n; });
      if (data.unmatched) { setMatchProfile(null); setToast('Swipe undone — match removed'); }
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
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-white font-semibold">Discover</h1>
              <p className="text-white/40 text-xs">{remaining.length} profiles remaining</p>
            </div>
          </div>
        </div>

        {/* Today's picks */}
        {picks.length > 0 && (
          <div className="border-b border-white/5 px-4 py-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-1.5 text-white text-sm font-semibold">
                  <Sparkles size={14} className="text-[#D4AF37]" />
                  Today&apos;s picks
                  <span className="text-white/30 font-normal text-xs">· {picks.length} of {picksLimit}</span>
                </h2>
                {!isPaid && (
                  <Link href="/upgrade" className="flex items-center gap-1 text-[#D4AF37] text-xs font-medium hover:underline">
                    <Crown size={11} />
                    Get 10 daily picks
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
                          <span className="text-white/40 text-2xl font-bold font-serif">{pickInitials}</span>
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                        {typeof pick.compatibility === 'number' && (
                          <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold text-[#D4AF37]">
                            {pick.compatibility}%
                          </span>
                        )}
                        {acted && (
                          <span className="absolute inset-0 flex items-center justify-center text-white/80 text-[10px] font-semibold">Seen</span>
                        )}
                      </div>
                      <p className="text-white/80 text-xs font-medium truncate mt-1.5">
                        {pick.displayName || pick.username}{pick.age ? <span className="text-white/40">, {pick.age}</span> : null}
                      </p>
                      {pick.distance && <p className="text-white/30 text-[10px] truncate">{pick.distance}</p>}
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
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-[#DC143C] border-t-transparent rounded-full animate-spin" />
              <p className="text-white/40 text-sm">Finding matches...</p>
            </div>
          ) : current ? (
            <div className="w-full max-w-sm">
              {/* Progress */}
              <p className="text-center text-white/30 text-xs mb-4">
                {remaining.length} profile{remaining.length !== 1 ? 's' : ''} remaining
              </p>

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
                  <div className="h-96 flex items-center justify-center relative bg-gradient-to-br from-rose-900 via-red-900 to-[#0A0A0F] overflow-hidden">
                    {current.profilePhotoUrl ? (
                      <ProtectedImage src={current.profilePhotoUrl} alt={current.username} className="w-full h-full" watermark={watermark} />
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
                    {current.isBoosted && (
                      <div className="absolute top-14 left-4 bg-[#DC143C]/80 backdrop-blur-sm px-2.5 py-1 rounded-full text-white text-xs font-bold flex items-center gap-1">
                        <Zap size={11} className="fill-white" />
                        Boosted
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
                      <h2 className="text-white text-2xl font-bold font-serif">
                        {current.displayName || current.username}{current.age ? `, ${current.age}` : ''}
                      </h2>
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
                        <p className="flex items-center gap-1.5 text-white/40 text-[11px] uppercase tracking-wider mb-1">
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
                  👋
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
                    className="flex items-center gap-1.5 glass px-3 py-1.5 rounded-lg text-white/50 hover:text-white text-xs transition-all hover:bg-white/10 disabled:opacity-50"
                    aria-label="Undo last swipe"
                    title={isPaid ? 'Undo your last swipe (within 10 minutes)' : 'Undo is a Gold & Platinum feature'}
                  >
                    {isPaid ? <Undo2 size={12} /> : <Lock size={11} className="text-[#D4AF37]" />}
                    {undoing ? 'Undoing…' : 'Undo'}
                  </button>
                )}
                <p className="hidden md:block text-white/25 text-xs tracking-wide">
                  ← Pass &nbsp;&nbsp; ❤ Like → &nbsp;&nbsp; ↑ Super Like
                </p>
                <p className="md:hidden text-white/20 text-xs">Swipe or tap to decide</p>
              </div>

            </div>
          ) : (
            <EmptyState
              icon={Zap}
              title="You've seen everyone!"
              description="Check back tomorrow for new members or adjust your preferences"
              action={{ label: 'Browse Members', href: '/members' }}
            />
          )}
        </div>
      </main>

      {/* Undo upgrade prompt */}
      {showUpgrade && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4" onClick={() => setShowUpgrade(false)}>
          <div className="glass rounded-3xl p-6 max-w-sm w-full text-center border border-[#D4AF37]/20" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mx-auto mb-4">
              <Undo2 className="text-[#D4AF37]" size={24} />
            </div>
            <h3 className="text-white font-serif text-xl font-bold mb-2">Changed your mind?</h3>
            <p className="text-white/50 text-sm mb-6">Gold and Platinum members can undo their last swipe and get that profile back.</p>
            <div className="flex flex-col gap-2">
              <Link
                href="/upgrade"
                className="flex items-center justify-center gap-2 bg-[#DC143C] hover:bg-[#FF1744] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                <Crown size={14} />
                Upgrade to undo
              </Link>
              <button onClick={() => setShowUpgrade(false)} className="text-white/40 hover:text-white/70 text-sm py-2">
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

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
