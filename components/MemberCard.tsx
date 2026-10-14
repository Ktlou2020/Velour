import Link from 'next/link';
import { MapPin, Crown, Star, Zap, Navigation } from 'lucide-react';

interface MemberCardProps {
  username: string;
  age: number;
  location: string;
  isOnline: boolean;
  interests?: string[];
  membershipTier?: 'FREE' | 'GOLD' | 'PLATINUM';
  gradient?: string;
  initials?: string;
  /** Formatted distance, e.g. "5 km away" */
  distance?: string;
  /** Compatibility score 0–100 */
  compatibility?: number;
  isBoosted?: boolean;
}

const GRADIENTS = [
  'from-rose-900 to-red-800',
  'from-indigo-900 to-purple-800',
  'from-emerald-900 to-teal-700',
  'from-amber-900 to-orange-800',
  'from-pink-900 to-rose-700',
  'from-blue-900 to-cyan-800',
  'from-violet-900 to-purple-700',
  'from-yellow-900 to-amber-700',
];

function getGradient(username: string) {
  const idx = username.charCodeAt(0) % GRADIENTS.length;
  return GRADIENTS[idx];
}

function getInitials(username: string) {
  return username.slice(0, 2).toUpperCase();
}

export default function MemberCard({
  username,
  age,
  location,
  isOnline,
  interests = [],
  membershipTier = 'FREE',
  gradient,
  initials,
  distance,
  compatibility,
  isBoosted = false,
}: MemberCardProps) {
  const bg = gradient || getGradient(username);
  const displayInitials = initials || getInitials(username);

  return (
    <Link href={`/members/${username}`} aria-label={`View ${username}'s profile`}>
      <div className="glass rounded-2xl overflow-hidden card-hover group cursor-pointer h-full">
        {/* Avatar */}
        <div className={`bg-gradient-to-br ${bg} h-40 flex items-center justify-center relative`}>
          <span className="text-white text-4xl font-bold font-serif">{displayInitials}</span>

          {/* Online badge */}
          {isOnline && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 glass px-2 py-1 rounded-full">
              <div className="w-2 h-2 bg-emerald-400 rounded-full online-pulse" />
              <span className="text-white/80 text-xs">Online</span>
            </div>
          )}

          {/* Tier badge */}
          {membershipTier !== 'FREE' && (
            <div className="absolute top-3 left-3">
              {membershipTier === 'PLATINUM' ? (
                <div className="flex items-center gap-1 bg-crimson-600/80 backdrop-blur-sm px-2 py-1 rounded-full">
                  <Crown size={10} className="text-white" />
                  <span className="text-white text-xs font-bold">Platinum</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-amber-600/80 backdrop-blur-sm px-2 py-1 rounded-full">
                  <Star size={10} className="text-white" />
                  <span className="text-white text-xs font-bold">Gold</span>
                </div>
              )}
            </div>
          )}
          {/* Boosted badge */}
          {isBoosted && (
            <div className={`absolute ${membershipTier !== 'FREE' ? 'top-10' : 'top-3'} left-3 flex items-center gap-1 bg-[#DC143C]/80 backdrop-blur-sm px-2 py-1 rounded-full`}>
              <Zap size={10} className="text-white fill-white" />
              <span className="text-white text-xs font-bold">Boosted</span>
            </div>
          )}

          {/* Compatibility badge */}
          {typeof compatibility === 'number' && compatibility > 0 && (
            <div className={`absolute bottom-3 left-3 glass px-2 py-1 rounded-full text-xs font-bold ${compatibility >= 70 ? 'text-[#D4AF37]' : 'text-white/80'}`}>
              {compatibility}% match
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="text-white font-semibold text-base group-hover:text-crimson-400 transition-colors">{username}</h3>
              <div className="flex items-center gap-1 text-white/65 text-xs mt-0.5">
                <MapPin size={10} />
                <span>{age} · {location}</span>
              </div>
              {distance && (
                <div className="flex items-center gap-1 text-white/60 text-xs mt-0.5">
                  <Navigation size={10} />
                  <span>{distance}</span>
                </div>
              )}
            </div>
          </div>

          {interests.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {interests.slice(0, 3).map((interest) => (
                <span key={interest} className="text-xs bg-white/5 border border-white/10 text-white/60 px-2 py-0.5 rounded-full">
                  {interest}
                </span>
              ))}
              {interests.length > 3 && (
                <span className="text-xs text-white/55">+{interests.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
