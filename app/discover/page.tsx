'use client';

import { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { X, Heart, Star, MapPin, RefreshCw } from 'lucide-react';

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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [animDir, setAnimDir] = useState<AnimDir>(null);
  const [matchProfile, setMatchProfile] = useState<Profile | null>(null);
  const actionInProgress = useRef(false);

  useEffect(() => {
    loadProfiles();
  }, []);

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

    // Post to API
    if (type !== 'PASS') {
      try {
        const res = await fetch('/api/likes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUsername: profile.username, type }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.isMatch) {
            // Show match overlay after animation
            setTimeout(() => setMatchProfile(profile), 350);
          }
        }
      } catch { /* ignore */ }
    }

    setTimeout(() => {
      setCurrentIndex((i) => i + 1);
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
              {/* Card Stack */}
              <div className="relative">
                {/* Back cards */}
                {remaining.slice(1, 4).map((_, i) => (
                  <div
                    key={i}
                    className="absolute inset-0 glass rounded-3xl"
                    style={{
                      transform: `scale(${1 - (i + 1) * 0.04}) translateY(${(i + 1) * 12}px)`,
                      zIndex: -i - 1,
                      opacity: 1 - (i + 1) * 0.2,
                    }}
                  />
                ))}

                {/* Main Card */}
                <div
                  className="relative glass rounded-3xl overflow-hidden shadow-2xl transition-all duration-300"
                  style={{
                    zIndex: 1,
                    transform: cardTransform || undefined,
                    opacity: animDir ? 0 : 1,
                  }}
                >
                  {/* Photo Area */}
                  <div className="h-96 flex items-center justify-center relative bg-gradient-to-br from-rose-900 via-red-900 to-[#0A0A0F] overflow-hidden">
                    {current.profilePhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={current.profilePhotoUrl} alt={current.username} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-8xl font-bold font-serif opacity-60">{initials}</span>
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

              <p className="text-center text-white/30 text-xs mt-4">
                {remaining.length - 1} more profiles to discover
              </p>
            </div>
          ) : (
            /* Empty State */
            <div className="text-center max-w-sm">
              <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
                <RefreshCw className="text-white/30" size={36} />
              </div>
              <h2 className="font-serif text-2xl font-bold text-white mb-3">No More Profiles</h2>
              <p className="text-white/50 mb-6 leading-relaxed">
                You&apos;ve gone through all available profiles. Check back later or expand your search.
              </p>
              <button onClick={loadProfiles} className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-8 py-3 rounded-xl font-semibold flex items-center gap-2 mx-auto transition-all">
                <RefreshCw size={16} />
                Refresh Profiles
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Match Overlay */}
      {matchProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm">
          <div className="glass rounded-3xl p-8 text-center max-w-sm w-full relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-[#DC143C]/20 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="font-serif text-3xl font-bold text-white mb-2">It&apos;s a Match!</h2>
              <p className="text-white/60 mb-6">
                You and <span className="text-white font-semibold">{matchProfile.displayName || matchProfile.username}</span> liked each other!
              </p>

              <div className="flex items-center justify-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center border-4 border-[#DC143C]">
                  <span className="text-white text-2xl font-bold font-serif">You</span>
                </div>
                <Heart className="text-[#DC143C] fill-current" size={28} />
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-900 to-violet-700 flex items-center justify-center border-4 border-[#D4AF37]">
                  <span className="text-white text-lg font-bold font-serif">
                    {(matchProfile.displayName || matchProfile.username).slice(0, 2).toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <a
                  href="/messages"
                  className="block w-full bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white py-3 rounded-xl font-semibold text-sm transition-all"
                >
                  Send Message
                </a>
                <button
                  onClick={() => setMatchProfile(null)}
                  className="block w-full glass py-3 rounded-xl text-white/60 hover:text-white text-sm font-medium transition-colors"
                >
                  Keep Discovering
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
