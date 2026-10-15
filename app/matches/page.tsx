'use client';

import { useState, useEffect } from 'react';
import ProtectedImage from '@/components/ProtectedImage';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import EmptyState from '@/components/EmptyState';
import { Heart, MessageCircle, MapPin, User, ChevronDown, Users, Star, Sparkles } from 'lucide-react';
import BlurredPeople from '@/components/plans/BlurredPeople';
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
  /** The matched person is part of a couple: "Thandi & Sipho" */
  couple?: { label: string; kind: 'linked' | 'shared' } | null;
  /** Who on my side matched (me, or my linked partner) */
  matchedVia?: { id: string; name: string; isMe: boolean };
}

interface LikedYou {
  id: string;
  type: 'LIKE' | 'WINK' | 'SUPERLIKE';
  createdAt: string;
  member: {
    id: string;
    username: string;
    displayName?: string;
    age?: number;
    ages?: number[];
    isCouple?: boolean;
    city?: string;
    profilePhotoUrl?: string;
    compatibility?: number;
    isOnline?: boolean;
  };
}

interface LikesResponse {
  locked: boolean;
  count: number;
  superCount: number;
  likes: LikedYou[];
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
  const [inCouple, setInCouple] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [likedYou, setLikedYou] = useState<LikesResponse | null>(null);
  const [likingBack, setLikingBack] = useState<string | null>(null);

  const isExpired = (m: Match) => !!m.expired || (!!m.expiresAt && new Date(m.expiresAt).getTime() < Date.now());
  const activeMatches = matches.filter(m => !isExpired(m));
  const expiredMatches = matches.filter(isExpired);

  function loadMatches() {
    return fetch('/api/matches')
      .then(r => r.json())
      .then(d => { setMatches(d.matches || []); setInCouple(!!d.inCouple); })
      .catch(() => {});
  }

  useEffect(() => {
    loadMatches().finally(() => setLoading(false));
    fetch('/api/likes')
      .then(r => (r.ok ? r.json() : null))
      .then((d: LikesResponse | null) => { if (d) setLikedYou(d); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep link from a "liked you" notification: /matches#liked-you (rendered after the fetch)
  useEffect(() => {
    if (!likedYou || typeof window === 'undefined' || window.location.hash !== '#liked-you') return;
    requestAnimationFrame(() => document.getElementById('liked-you')?.scrollIntoView({ block: 'start' }));
  }, [likedYou]);

  async function likeBack(l: LikedYou, type: 'LIKE' | 'PASS') {
    setLikingBack(l.member.id);
    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: l.member.id, type }),
      });
      if (res.ok) {
        setLikedYou(prev => prev ? { ...prev, count: Math.max(0, prev.count - 1), likes: prev.likes.filter(x => x.id !== l.id) } : prev);
        const d = await res.json().catch(() => ({})) as { matched?: boolean };
        if (d.matched) await loadMatches();
      }
    } catch { /* ignore */ }
    setLikingBack(null);
  }

  function renderLikedYou() {
    if (!likedYou || likedYou.count === 0) return null;
    if (likedYou.locked) {
      return (
        <section id="liked-you" aria-labelledby="liked-you-title" className="mb-10 scroll-mt-24">
          <h2 id="liked-you-title" className="flex items-center gap-2 text-white font-semibold mb-3">
            <Heart size={16} className="text-[#FF4D6D] fill-[#FF4D6D]" aria-hidden="true" /> Liked you
            <span className="text-white/55 font-normal text-sm">· {likedYou.count}</span>
          </h2>
          <BlurredPeople
            count={likedYou.count}
            headline={`${likedYou.count} ${likedYou.count === 1 ? 'person has' : 'people have'} already liked you`}
            body={`${likedYou.superCount > 0 ? `Including ${likedYou.superCount} super like${likedYou.superCount === 1 ? '' : 's'}. ` : ''}With Gold you'll see exactly who — like them back and it's an instant match. Or keep swiping in Discover: when you like each other, they'll appear here.`}
          />
        </section>
      );
    }
    return (
      <section id="liked-you" aria-labelledby="liked-you-title" className="mb-10 scroll-mt-24">
        <h2 id="liked-you-title" className="flex items-center gap-2 text-white font-semibold mb-1">
          <Heart size={16} className="text-[#FF4D6D] fill-[#FF4D6D]" aria-hidden="true" /> Liked you
          <span className="text-white/55 font-normal text-sm">· {likedYou.count}</span>
        </h2>
        <p className="text-white/55 text-sm mb-4">Like them back for an instant match.</p>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {likedYou.likes.map((l) => {
            const m = l.member;
            const name = m.displayName || m.username;
            const age = m.isCouple && m.ages?.length ? m.ages.join(' & ') : m.age;
            return (
              <div key={l.id} className={`shrink-0 w-40 glass rounded-2xl overflow-hidden ${l.type === 'SUPERLIKE' ? 'ring-1 ring-[#D4AF37]/50' : ''}`}>
                <Link href={`/members/${m.username}`} className="block aspect-[3/4] relative bg-gradient-to-br from-rose-950 to-[#0A0A0F]">
                  {m.profilePhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <ProtectedImage src={m.profilePhotoUrl} alt={name} className="w-full h-full" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-white/55 text-3xl font-bold font-serif">{name.slice(0, 2).toUpperCase()}</span>
                  )}
                  {l.type === 'SUPERLIKE' && (
                    <span className="absolute top-2 left-2 flex items-center gap-1 bg-[#D4AF37] text-[#0A0A0F] text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                      <Star size={9} className="fill-[#0A0A0F]" aria-hidden="true" /> SUPER
                    </span>
                  )}
                  {l.type === 'WINK' && <span className="absolute top-2 left-2 glass text-[11px] px-1.5 py-0.5 rounded-md" title="Winked at you">😉</span>}
                  {typeof m.compatibility === 'number' && m.compatibility > 0 && (
                    <span className="absolute bottom-2 left-2 flex items-center gap-0.5 glass text-[10px] font-bold px-1.5 py-0.5 rounded-md text-[#D4AF37]">
                      <Sparkles size={9} aria-hidden="true" /> {m.compatibility}%
                    </span>
                  )}
                </Link>
                <div className="p-2.5">
                  <p className="text-white text-sm font-semibold truncate">{name}{age ? <span className="text-white/60 font-normal">, {age}</span> : null}</p>
                  <p className="text-white/50 text-[11px] truncate">{m.city ?? ''}{m.city ? ' · ' : ''}{timeAgo(l.createdAt)}</p>
                  <div className="flex gap-1.5 mt-2">
                    <button
                      onClick={() => likeBack(l, 'LIKE')}
                      disabled={likingBack === m.id}
                      className="flex-1 flex items-center justify-center gap-1 bg-[#DC143C] hover:bg-[#FF1744] text-white text-xs font-semibold py-1.5 rounded-lg disabled:opacity-60"
                    >
                      <Heart size={11} className="fill-white" aria-hidden="true" /> Like back
                    </button>
                    <button
                      onClick={() => likeBack(l, 'PASS')}
                      disabled={likingBack === m.id}
                      className="px-2 glass text-white/60 hover:text-white text-xs rounded-lg disabled:opacity-60"
                      aria-label={`Pass on ${name}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // Opens (or creates) the shared conversation — both partners of a couple are in it
  async function startConversation(username: string) {
    setOpening(username);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUsername: username }),
      });
      if (res.ok) {
        const data = await res.json() as { conversation?: { id: string }; id?: string };
        const convId = data.conversation?.id ?? data.id;
        if (convId) { window.location.href = `/messages?conv=${convId}`; return; }
      }
    } catch { /* ignore */ }
    setOpening(null);
  }

  function renderCard(match: Match, expired: boolean) {
    const other = match.otherUser;
    const profile = other.profile;
    const name = match.couple?.label || profile?.displayName || other.username;
    const initials = name.slice(0, 2).toUpperCase();
    const location = [profile?.city, profile?.country].filter(Boolean).join(', ');

    return (
      <div key={match.id} className={`glass rounded-2xl overflow-hidden group ${expired ? 'opacity-50' : ''}`}>
        {/* Photo */}
        <div className="aspect-[3/4] relative overflow-hidden">
          {profile?.profilePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <ProtectedImage
              src={profile.profilePhoto}
              alt={name}
              className="w-full h-full"
              imgClassName={`w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-300 ${expired ? 'grayscale' : ''}`}
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
          <p className="text-white text-sm font-semibold truncate flex items-center gap-1.5">
            <span className="truncate">{name}</span>
            {match.couple && (
              <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium text-[#D4AF37] border border-[#D4AF37]/30 rounded-full px-1.5 py-px">
                <Users size={9} aria-hidden="true" /> Couple
              </span>
            )}
          </p>
          {inCouple && match.matchedVia && (
            <p className="text-white/55 text-[11px] truncate">
              {match.matchedVia.isMe ? 'Matched with you' : `Matched with ${match.matchedVia.name}`}
            </p>
          )}
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
              disabled={opening === other.username}
              className="flex-1 disabled:opacity-60 flex items-center justify-center gap-1.5 bg-[#DC143C] hover:bg-[#FF1744] text-white text-xs font-semibold py-2 rounded-lg transition-colors"
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
          {!loading && renderLikedYou()}
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
