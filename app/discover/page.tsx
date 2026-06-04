'use client';

import { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import EmptyState from '@/components/EmptyState';
import MatchOverlay from '@/components/MatchOverlay';
import ProtectedImage from '@/components/ProtectedImage';
import { useSession } from 'next-auth/react';
import { X, Heart, Star, MapPin, Zap } from 'lucide-react';

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
}

type ActionType = 'LIKE' | 'SUPER_LIKE' | 'WINK' | 'PASS';
type AnimDir = 'left' | 'right' | 'up' | null;

export default function DiscoverPage() {
  const { data: session } = useSession();
  const watermark = (session?.user as { username?: string })?.username ?? session?.user?.email ?? 'velour';
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [animDir, setAnimDir] = useState<AnimDir>(null);
  const [matchProfile, setMatchProfile] = useState<Profile | null>(null);
  const [dragHint, setDragHint] = useState<'PASS' | 'LIKE' | null>(null);
  const actionInProgress = useRef(false);
  const dragStartX = useRef<number | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

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

    setTimeout(() => {
      setCurrentIndex((i) => {
        const next = i + 1;
        // Auto-reload when we're near the end
        if (next >= profiles.length - 2) {
          loadProfiles();
        }
        return next;
      });
      setAnimDir(null);
      actionInProgress.current = false;
    }, 300);
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
                  className="relative glass rounded-3xl overflow-hidden shadow-2xl transition-all duration-300 cursor-grab active:cursor-grabbing"
                  style={{
                    zIndex: 1,
                    transform: cardTransform || undefined,
                    opacity: animDir ? 0 : 1,
                  }}
                  onMouseDown={(e) => { dragStartX.current = e.clientX; }}
                  onMouseMove={(e) => {
                    if (dragStartX.current === null) return;
                    const delta = e.clientX - dragStartX.current;
                    if (delta > 40) setDragHint('LIKE');
                    else if (delta < -40) setDragHint('PASS');
                    else setDragHint(null);
                  }}
                  onMouseUp={() => {
                    if (dragHint === 'LIKE') doAction('LIKE', 'right');
                    else if (dragHint === 'PASS') doAction('PASS', 'left');
                    dragStartX.current = null;
                    setDragHint(null);
                  }}
                  onMouseLeave={() => { dragStartX.current = null; setDragHint(null); }}
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
                      {location && (
                        <div className="flex items-center gap-1 text-white/70 text-sm mt-1">
                          <MapPin size={12} />
                          {location}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bio + Interests */}
                  <div className="p-5">
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

              {/* Desktop keyboard hint */}
              <p className="hidden md:block text-center text-white/25 text-xs mt-4 tracking-wide">
                ← Pass &nbsp;&nbsp; ❤ Like → &nbsp;&nbsp; ↑ Super Like
              </p>

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

      {/* Match Overlay */}
      <MatchOverlay
        show={!!matchProfile}
        matchedUser={{
          name: matchProfile ? (matchProfile.displayName || matchProfile.username) : '',
          photo: matchProfile?.profilePhotoUrl,
        }}
        onMessage={() => { window.location.href = '/messages'; }}
        onClose={() => setMatchProfile(null)}
      />
    </div>
  );
}
