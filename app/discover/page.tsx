'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { X, Heart, Star, MapPin, RefreshCw, Settings2 } from 'lucide-react';

const PROFILES = [
  { username: 'Sofia_M', age: 28, location: 'London, UK', bio: 'Fashion consultant. Lover of jazz, fine wine, and spontaneous adventures. Looking for real connection.', interests: ['Travel', 'Wine', 'Art', 'Jazz'], initials: 'SM', gradient: 'from-rose-900 via-red-800 to-crimson-700', isOnline: true },
  { username: 'AnnaParis', age: 26, location: 'Paris, FR', bio: 'Parisian artist. I paint, I laugh, I explore. Life is a canvas — let\'s colour it together.', interests: ['Art', 'Photography', 'Dance', 'Culture'], initials: 'AP', gradient: 'from-emerald-900 via-teal-800 to-teal-700', isOnline: true },
  { username: 'LilyRose', age: 29, location: 'Sydney, AU', bio: 'Yoga teacher by day, bookworm by night. Looking for someone to share sunrise hikes and good stories.', interests: ['Yoga', 'Hiking', 'Reading', 'Nature'], initials: 'LR', gradient: 'from-pink-900 via-rose-800 to-rose-700', isOnline: false },
  { username: 'ChantalB', age: 25, location: 'Brussels, BE', bio: 'Chocolatier and fashion lover. Fluent in three languages and the language of good food.', interests: ['Food', 'Fashion', 'Travel', 'Languages'], initials: 'CB', gradient: 'from-violet-900 via-purple-800 to-purple-700', isOnline: true },
  { username: 'IrinaK', age: 27, location: 'Moscow, RU', bio: 'Ballet dancer with a passion for literature. Looking for depth, not just dates.', interests: ['Ballet', 'Literature', 'Skiing', 'Music'], initials: 'IK', gradient: 'from-blue-900 via-cyan-800 to-cyan-700', isOnline: false },
];

export default function DiscoverPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liked, setLiked] = useState<string[]>([]);
  const [passed, setPassed] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const remaining = PROFILES.filter((_, i) => i >= currentIndex);
  const current = remaining[0];

  function handlePass() {
    if (!current) return;
    setPassed((p) => [...p, current.username]);
    setCurrentIndex((i) => i + 1);
  }

  function handleLike() {
    if (!current) return;
    setLiked((l) => [...l, current.username]);
    setCurrentIndex((i) => i + 1);
  }

  function handleSuperLike() {
    if (!current) return;
    setLiked((l) => [...l, current.username]);
    setCurrentIndex((i) => i + 1);
  }

  function handleReset() {
    setCurrentIndex(0);
    setLiked([]);
    setPassed([]);
  }

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

            {/* Filter Bar */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <select className="input-dark px-3 py-1.5 rounded-lg text-xs bg-[#0A0A0F] text-white/60" aria-label="Age range">
                  <option>18–35 yrs</option>
                  <option>25–45 yrs</option>
                  <option>30–50 yrs</option>
                </select>
                <select className="input-dark px-3 py-1.5 rounded-lg text-xs bg-[#0A0A0F] text-white/60" aria-label="Location radius">
                  <option>50km radius</option>
                  <option>100km</option>
                  <option>Worldwide</option>
                </select>
                <select className="input-dark px-3 py-1.5 rounded-lg text-xs bg-[#0A0A0F] text-white/60" aria-label="Relationship type">
                  <option>All types</option>
                  <option>Single</option>
                  <option>Couple</option>
                  <option>Poly</option>
                </select>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="sm:hidden glass px-3 py-1.5 rounded-lg text-white/60 hover:text-white text-sm flex items-center gap-1"
                aria-label="Filters"
              >
                <Settings2 size={14} />
              </button>

              <div className="flex items-center gap-2 glass px-3 py-1.5 rounded-lg">
                <Heart size={12} className="text-crimson-500" />
                <span className="text-white/60 text-xs">{liked.length} liked</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Filters */}
        {showFilters && (
          <div className="sm:hidden glass-dark border-b border-white/5 px-4 py-3 flex gap-2 flex-wrap">
            <select className="input-dark px-3 py-1.5 rounded-lg text-xs bg-[#0A0A0F] text-white/60" aria-label="Age range">
              <option>18–35 yrs</option>
              <option>25–45 yrs</option>
            </select>
            <select className="input-dark px-3 py-1.5 rounded-lg text-xs bg-[#0A0A0F] text-white/60" aria-label="Relationship type">
              <option>All types</option>
              <option>Single</option>
            </select>
          </div>
        )}

        {/* Card Area */}
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          {current ? (
            <div className="w-full max-w-sm">
              {/* Card Stack Visual */}
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
                <div className="relative glass rounded-3xl overflow-hidden shadow-2xl" style={{ zIndex: 1 }}>
                  {/* Photo Area */}
                  <div className={`bg-gradient-to-br ${current.gradient} h-96 flex items-center justify-center relative`}>
                    <span className="text-white text-8xl font-bold font-serif opacity-60">{current.initials}</span>

                    {current.isOnline && (
                      <div className="absolute top-4 right-4 flex items-center gap-1.5 glass px-3 py-1.5 rounded-full">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full online-pulse" />
                        <span className="text-white text-xs font-medium">Online</span>
                      </div>
                    )}

                    {/* Gradient overlay */}
                    <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 to-transparent" />

                    {/* Profile info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <div className="flex items-end justify-between">
                        <div>
                          <h2 className="text-white text-2xl font-bold font-serif">{current.username}, {current.age}</h2>
                          <div className="flex items-center gap-1 text-white/70 text-sm mt-1">
                            <MapPin size={12} />
                            {current.location}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-white/60 text-xs">Match</div>
                          <div className="text-crimson-400 font-bold text-lg">{Math.floor(75 + Math.random() * 20)}%</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="p-5">
                    <p className="text-white/70 text-sm leading-relaxed mb-4">{current.bio}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {current.interests.map((interest) => (
                        <span key={interest} className="glass px-2.5 py-1 rounded-full text-white/60 text-xs">{interest}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  onClick={handlePass}
                  className="w-16 h-16 rounded-full glass border-2 border-red-500/50 hover:border-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  aria-label="Pass"
                >
                  <X className="text-red-400" size={28} />
                </button>

                <button
                  onClick={handleSuperLike}
                  className="w-14 h-14 rounded-full glass border-2 border-gold-500/50 hover:border-gold-500 hover:bg-gold-500/10 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  aria-label="Super like"
                >
                  <Star className="text-gold-400" size={22} />
                </button>

                <button
                  onClick={handleLike}
                  className="w-16 h-16 rounded-full bg-crimson-500 hover:bg-crimson-400 flex items-center justify-center transition-all hover:scale-110 active:scale-95 glow-crimson"
                  aria-label="Like"
                >
                  <Heart className="text-white fill-white" size={28} />
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
              <h2 className="font-serif text-2xl font-bold text-white mb-3">You&apos;ve Seen Everyone!</h2>
              <p className="text-white/50 mb-6 leading-relaxed">
                You&apos;ve gone through all your daily profiles. Come back tomorrow for fresh matches, or expand your search radius.
              </p>
              <div className="text-white/40 text-sm mb-6">
                You liked <span className="text-crimson-400 font-semibold">{liked.length}</span> people today
              </div>
              <button onClick={handleReset} className="btn-crimson px-8 py-3 rounded-xl font-semibold flex items-center gap-2 mx-auto">
                <RefreshCw size={16} />
                Start Over
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
