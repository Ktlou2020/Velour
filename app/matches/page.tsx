'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import EmptyState from '@/components/EmptyState';
import { Heart, MessageCircle, MapPin, User } from 'lucide-react';

interface Match {
  id: string;
  createdAt: string;
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
      const data = await res.json();
      window.location.href = `/messages?conv=${data.id}`;
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        {/* Header */}
        <div className="bg-gradient-to-b from-[#0F0A1E] to-[#0A0A0F] py-12 px-4 border-b border-white/5">
          <div className="max-w-5xl mx-auto">
            <h1 className="font-serif text-4xl font-bold text-white mb-2">Your Matches</h1>
            <p className="text-white/50">People who liked you back</p>
            {!loading && (
              <p className="text-white/30 text-sm mt-1">{matches.length} match{matches.length !== 1 ? 'es' : ''}</p>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-[#DC143C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : matches.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="No matches yet"
              description="Keep discovering and liking profiles — your matches will appear here"
              action={{ label: 'Discover People', href: '/discover' }}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {matches.map((match) => {
                const other = match.otherUser;
                const profile = other.profile;
                const name = profile?.displayName || other.username;
                const initials = name.slice(0, 2).toUpperCase();
                const location = [profile?.city, profile?.country].filter(Boolean).join(', ');

                return (
                  <div key={match.id} className="glass rounded-2xl overflow-hidden group">
                    {/* Photo */}
                    <div className="aspect-[3/4] relative overflow-hidden">
                      {profile?.profilePhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={profile.profilePhoto}
                          alt={name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${gradientFor(other.username)} flex items-center justify-center`}>
                          <span className="text-white/40 text-4xl font-bold font-serif">{initials}</span>
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
                      {location && (
                        <div className="flex items-center gap-1 text-white/30 text-xs">
                          <MapPin size={10} />
                          <span className="truncate">{location}</span>
                        </div>
                      )}
                      <div className="flex gap-1.5 pt-1">
                        <button
                          onClick={() => startConversation(other.username)}
                          className="flex-1 flex items-center justify-center gap-1 bg-[#DC143C] hover:bg-[#FF1744] text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
                        >
                          <MessageCircle size={11} />
                          Message
                        </button>
                        <Link
                          href={`/members/${other.username}`}
                          className="flex items-center justify-center w-8 glass hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors"
                        >
                          <User size={13} />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
