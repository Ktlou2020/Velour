'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import EmptyState from '@/components/EmptyState';
import { Heart, MessageCircle, MapPin, User, ChevronDown } from 'lucide-react';
import ExpiryCountdown from '@/components/chat/ExpiryCountdown';

interface Match {
  id: string;
  createdAt: string;
  expiresAt?: string | null;
  expired?: boolean;
  otherUser: {
    id: string;
    username: string;
    profile?: {
      displayName?: string;
      profilePhoto?: string;
      city?: string;
      country?: string;
      isOnline?: boolean;
    };
  };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / 86400000);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const GRADIENTS = [
  'from-rose-900 to-red-800',
  'from-emerald-900 to-teal-700',
  'from-violet-900 to-purple-700',
  'from-blue-900 to-cyan-800',
  'from-amber-900 to-orange-800',
];
function gradientFor(u: string) { return GRADIENTS[u.charCodeAt(0) % GRADIENTS.length]; }

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExpired, setShowExpired] = useState(false);

  const isExpired = (m: Match) => !!m.expired || (!!m.expiresAt && new Date(m.expiresAt).getTime() < Date.now());
  const activeMatches = matches.filter(m => !isExpired(m));
  const expiredMatches = matches.filter(isExpired);

  useEffect(() => {
    fetch('/api/matches')
      .then(r => r.json())
      .then(d => setMatches(d.matches || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function startConversation(username: string) {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUsername: username }),
    });
    if (res.ok) {
      const data = await res.json() as { conversation?: { id: string }; id?: string };
      const convId = data.conversation?.id ?? data.id;
      if (convId) window.location.href = `/messages?conv=${convId}`;
    }
  }

  function renderCard(match: Match, expired: boolean) {
    const other = match.otherUser;
    const profile = other.profile;
    const name = profile?.displayName || other.username;
    const initials = name.slice(0, 2).toUpperCase();
    const location = [profile?.city, profile?.country].filter(Boolean).join(', ');

    return (
      <div key={match.id} className={`glass rounded-2xl overflow-hidden group ${expired ? 'opacity-50' : ''}`}>
        {/* Photo */}
        <div className="aspect-[3/4] relative overflow-hidden">
          {profile?.profilePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profilePhoto}
              alt={name}
              loading="lazy"
              decoding="async"
              width={300}
              height={400}
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${expired ? 'grayscale' : ''}`}
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradientFor(other.username)} flex items-center justify-center`}>
              <span className="text-white/60 text-4xl font-bold font-serif">{initials}</span>
            </div>
          )}

          {/* Online dot */}
          {profile?.isOnline && (
            <div className="absolute top-2 right-2 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0A0A0F] animate-pulse" />
          )}

          {/* Match time */}
          <div className="absolute top-2 left-2 glass px-2 py-0.5 rounded-full text-white/60 text-xs">
            {timeAgo(match.createdAt)}
          </div>

          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />
        </div>

        {/* Info */}
        <div className="p-3 space-y-2">
          <p className="text-white text-sm font-semibold truncate">{name}</p>
          {match.expiresAt && !expired && (
            <ExpiryCountdown expiresAt={match.expiresAt} nudge />
          )}
          {expired && <p className="text-white/60 text-xs">Expired — nobody said hi</p>}
          {location && (
            <div className="flex items-center gap-1 text-white/55 text-xs">
              <MapPin size={10} />
              <span className="truncate">{location}</span>
            </div>
          )}
          <div className="flex gap-1.5 pt-1">
            {!expired && <button
              onClick={() => startConversation(other.username)}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#DC143C] hover:bg-[#FF1744] text-white text-xs font-semibold py-2 rounded-lg transition-colors"
            >
              <MessageCircle size={12} aria-hidden="true" />
              Message
            </button>}
            <Link
              href={`/members/${other.username}`}
              className="flex items-center justify-center w-9 glass hover:bg-white/10 text-white/70 hover:text-white rounded-lg transition-colors"
              aria-label={`View ${name}'s profile`}
            >
              <User size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        {/* Header */}
        <div className="bg-gradient-to-b from-[#0F0A1E] to-[#0A0A0F] py-8 sm:py-12 px-4 border-b border-white/5">
          <div className="max-w-5xl mx-auto">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-2">Your matches</h1>
            <p className="text-white/65">You liked each other — now say hello.</p>
            {!loading && activeMatches.length > 0 && (
              <p className="text-white/55 text-sm mt-1">{activeMatches.length} match{activeMatches.length !== 1 ? 'es' : ''}</p>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-8">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" aria-busy="true" aria-label="Loading matches">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass rounded-2xl overflow-hidden">
                  <div className="aspect-[3/4] skeleton" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 w-2/3 rounded skeleton" />
                    <div className="h-7 rounded-lg skeleton" />
                  </div>
                </div>
              ))}
            </div>
          ) : activeMatches.length === 0 && expiredMatches.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Your first match is close"
              description="When someone you’ve liked likes you back, they’ll appear here. Start with a few likes in Discover."
              action={{ label: 'Start discovering', href: '/discover' }}
              secondaryAction={{ label: 'Browse members', href: '/members' }}
            />
          ) : activeMatches.length === 0 ? (
            <p className="text-white/60 text-sm text-center py-10">
              No active matches right now. <Link href="/discover" className="text-[#DC143C] hover:text-[#FF1744]">Discover people</Link>
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {activeMatches.map(m => renderCard(m, false))}
            </div>
          )}

          {!loading && expiredMatches.length > 0 && (
            <div className="mt-10">
              <button
                onClick={() => setShowExpired(v => !v)}
                className="flex items-center gap-1.5 text-white/60 hover:text-white/70 text-sm mb-4 transition-colors"
              >
                <ChevronDown size={14} className={`transition-transform ${showExpired ? 'rotate-180' : ''}`} />
                {expiredMatches.length} expired match{expiredMatches.length !== 1 ? 'es' : ''}
              </button>
              {showExpired && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {expiredMatches.map(m => renderCard(m, true))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
