'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin, Shield, Eye, Heart, MessageCircle, Flag, Crown, Star, Camera, X, Check,
  Zap, Calendar, UserCheck, Flame, ChevronLeft, ChevronRight, Quote, Video, Navigation, Sparkles,
  Ban,
} from 'lucide-react';
import type { ReactElement } from 'react';
import type { Session } from 'next-auth';
import ProtectedImage from '@/components/ProtectedImage';
import MemberAlbums from '@/components/albums/MemberAlbums';
import PersonCard from '@/app/profile/identity/PersonCard';
import type { PublicIdentity } from '@/lib/identity';
import StatusPill from '@/components/status/StatusPill';
import type { ActiveStatus } from '@/components/status/status';
import BadgeRow from '@/components/badges/BadgeRow';
import SparkAnswers, { type SparkAnswerView } from '@/components/spark/SparkAnswers';
import type { Badge } from '@/lib/badges';

interface Photo {
  id: string;
  url: string;
  isProfile?: boolean;
  isPrivate?: boolean;
}

interface Profile {
  id?: string;
  username?: string;
  displayName?: string;
  age?: number;
  city?: string;
  country?: string;
  bio?: string;
  isOnline?: boolean;
  isVerified?: boolean;
  membershipTier?: 'FREE' | 'GOLD' | 'PLATINUM';
  interests?: string[];
  identity?: PublicIdentity;
  photos?: Photo[];
  profileViews?: number;
  likesReceived?: number;
  relationshipStatus?: string;
  memberSince?: string;
  compatibilityScore?: number;
  compatibilityReasons?: string[];
  sharedInterests?: string[];
  insightsLocked?: boolean;
  distance?: string;
  videoUrl?: string;
  prompts?: { question: string; answer: string }[];
  status?: ActiveStatus | null;
  badges?: Badge[];
  sparkAnswers?: SparkAnswerView[];
}

interface Props {
  username: string;
  profile: (Profile & { photos?: Photo[] }) | null;
  session: Session | null;
}

const REPORT_REASONS = [
  'Fake profile / Catfishing',
  'Inappropriate content',
  'Harassment or abuse',
  'Spam or scam',
  'Underage user',
  'Other',
];

const TIER_BADGE: Record<string, ReactElement> = {
  GOLD: (
    <span className="flex items-center gap-1 bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold px-2.5 py-1 rounded-full">
      <Crown size={10} /> Gold
    </span>
  ),
  PLATINUM: (
    <span className="flex items-center gap-1 bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold px-2.5 py-1 rounded-full">
      <Star size={10} /> Platinum
    </span>
  ),
};

export default function MemberProfileClient({ username, profile: raw, session }: Props) {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [superLiked, setSuperLiked] = useState(false);
  const [winked, setWinked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportNote, setReportNote] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [messagingLoading, setMessagingLoading] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const p: Profile = raw ?? {};
  const photos: Photo[] = (p.photos ?? []).filter((ph) => !ph.isPrivate);

  const displayName = p.displayName || username.replace(/_/g, ' ');
  const initials = displayName.slice(0, 2).toUpperCase();
  const location = [p.city, p.country].filter(Boolean).join(', ') || 'Unknown location';
  const tier = p.membershipTier ?? 'FREE';
  const heroPhoto = photos.find(ph => ph.isProfile) ?? photos[0];
  const compatScore = p.compatibilityScore;
  const sharedSet = new Set((p.sharedInterests ?? []).map((i) => i.toLowerCase()));
  const identity = p.identity;
  const isCouple = !!identity?.isCouple;
  const self = !isCouple ? identity?.people[0] : undefined;
  const ageText = isCouple
    ? (identity?.ages.length ? identity.ages.join(' & ') : undefined)
    : (p.age ? `${p.age} years old` : undefined);
  const STATUS_LABELS: Record<string, string> = { SINGLE: 'Single', IN_RELATIONSHIP: 'In a relationship', COMPLICATED: "It's complicated" };

  async function handleLike() {
    setLiked(!liked);
    await fetch('/api/likes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUsername: username, type: 'LIKE' }) }).catch(() => {});
  }

  async function handleSuperLike() {
    setSuperLiked(!superLiked);
    const res = await fetch('/api/likes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUsername: username, type: 'SUPERLIKE' }) }).catch(() => null);
    if (res && !res.ok) {
      setSuperLiked(false);
      const d = await res.json().catch(() => ({})) as { error?: string };
      alert(d.error ?? 'Not enough super like credits');
    }
  }

  async function handleWink() {
    setWinked(!winked);
    await fetch('/api/likes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUsername: username, type: 'WINK' }) }).catch(() => {});
  }

  async function handleMessage() {
    if (!session) { router.push('/auth/signin'); return; }
    setMessagingLoading(true);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUsername: username }),
      });
      if (res.ok) {
        const data = await res.json() as { conversation?: { id: string } };
        router.push(data.conversation?.id ? `/messages?conv=${data.conversation.id}` : '/messages');
      }
    } finally { setMessagingLoading(false); }
  }

  async function handleBlock() {
    if (!raw?.id) return;
    if (!window.confirm(`Block ${displayName}? They won't be able to see your profile or message you, and any match between you will be removed.`)) return;
    setBlocking(true);
    try {
      const res = await fetch('/api/block', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: raw!.id }) });
      if (res.ok) router.push('/members');
    } finally { setBlocking(false); }
  }

  async function handleReport() {
    if (!reportReason) return;
    setReportSubmitting(true);
    await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUsername: username, reason: reportReason, note: reportNote }) }).catch(() => {});
    setReportSubmitted(true);
    setReportSubmitting(false);
  }

  return (
    <>
      {/* ─── HERO ─────────────────────────────────────────────────────── */}
      <div className="relative min-h-[50vh] sm:min-h-[60vh] flex flex-col justify-end overflow-hidden pt-20">
        {/* Background blurred photo */}
        {heroPhoto ? (
          <div className="absolute inset-0">
            <ProtectedImage src={heroPhoto.url} alt="" className="w-full h-full object-cover" watermark="" loading="eager" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/70 to-black/20" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#1A0007] via-[#100008] to-[#0A0A0F]">
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(220,20,60,0.25) 0%, transparent 60%)' }} />
          </div>
        )}

        <div className="relative max-w-5xl mx-auto px-4 pb-8 w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0 -mb-2">
              <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-3xl overflow-hidden border-4 border-[#0A0A0F] shadow-2xl bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center">
                {heroPhoto ? (
                  <ProtectedImage src={heroPhoto.url} alt={`${displayName}'s profile photo`} className="w-full h-full" watermark={session?.user?.email ?? 'hush'} loading="eager" />
                ) : (
                  <span className="text-white text-5xl font-bold font-serif">{initials}</span>
                )}
              </div>
              {p.isOnline && (
                <div className="absolute bottom-2 right-2 w-5 h-5 bg-emerald-400 rounded-full border-2 border-[#0A0A0F] shadow" />
              )}
            </div>

            {/* Name + badges */}
            <div className="flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="font-serif text-3xl sm:text-5xl font-bold text-white drop-shadow-lg break-words">{displayName}</h1>
                {self?.pronouns && <span className="text-white/70 text-sm sm:text-base">({self.pronouns})</span>}
                {isCouple && (
                  <span className="flex items-center gap-1 bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold px-2.5 py-1 rounded-full">
                    {identity?.coupleBadge ?? 'Couple'}
                  </span>
                )}
                {tier !== 'FREE' && TIER_BADGE[tier]}
                {p.isVerified && (
                  <span className="flex items-center gap-1 bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs font-bold px-2.5 py-1 rounded-full">
                    <Check size={10} strokeWidth={3} /> Verified
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-white/80 text-sm">
                <span className="flex items-center gap-1.5"><MapPin size={13} />{location}</span>
                {p.distance && <span className="flex items-center gap-1.5"><Navigation size={13} />{p.distance}</span>}
                {ageText && <span className="flex items-center gap-1.5"><Calendar size={13} />{ageText}</span>}
                {p.isOnline
                  ? <span className="flex items-center gap-1.5 text-emerald-400"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Online now</span>
                  : p.memberSince && <span className="flex items-center gap-1.5"><UserCheck size={13} />Since {p.memberSince}</span>
                }
              </div>
              {p.status && <StatusPill status={p.status} className="mt-3" />}
              {(p.badges?.length ?? 0) > 0 && <BadgeRow badges={p.badges ?? []} max={5} className="mt-3" />}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 sm:gap-3 mt-6">
            <button
              onClick={handleMessage}
              disabled={messagingLoading}
              className="flex-1 sm:flex-none justify-center bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 text-sm shadow-lg shadow-[#DC143C]/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
            >
              {messagingLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <MessageCircle size={16} />}
              Send Message
            </button>
            <button
              onClick={handleLike}
              aria-pressed={liked}
              className={`flex-1 sm:flex-none justify-center glass border px-5 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 ${liked ? 'border-[#DC143C]/70 bg-[#DC143C]/15 text-[#DC143C]' : 'border-white/20 hover:border-[#DC143C]/40 text-white'}`}
            >
              <Heart size={16} className={liked ? 'fill-current' : ''} />
              {liked ? 'Liked!' : 'Like'}
            </button>
            <button
              onClick={handleSuperLike}
              aria-pressed={superLiked}
              className={`glass border px-4 sm:px-5 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 ${superLiked ? 'border-[#D4AF37]/70 bg-[#D4AF37]/15 text-[#D4AF37]' : 'border-white/20 hover:border-[#D4AF37]/40 text-white'}`}
            >
              <Star size={16} className={superLiked ? 'fill-current' : ''} />
              Super Like
            </button>
            <button
              onClick={handleWink}
              aria-pressed={winked}
              className={`glass border px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 transition-all hover:scale-105 active:scale-95 ${winked ? 'border-amber-400/60 bg-amber-500/10 text-amber-400' : 'border-white/20 text-white/70 hover:text-white'}`}
            >
              <span aria-hidden="true">👋</span> {winked ? 'Winked!' : 'Wink'}
            </button>
            <button
              onClick={handleBlock}
              disabled={blocking}
              className="glass w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-3 flex items-center justify-center rounded-xl text-white/65 hover:text-red-400 text-sm transition-all ml-auto disabled:opacity-40"
              aria-label="Block member"
              title="Block"
            >
              <Ban size={16} aria-hidden="true" />
            </button>
            <button
              onClick={() => setShowReportModal(true)}
              className="glass w-11 h-11 sm:w-auto sm:h-auto sm:px-4 sm:py-3 flex items-center justify-center rounded-xl text-white/65 hover:text-red-400 text-sm transition-all"
              aria-label="Report member"
              title="Report"
            >
              <Flag size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── STATS BAR ────────────────────────────────────────────────── */}
      <div className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-3 divide-x divide-white/5">
          {[
            { icon: Eye, label: 'Views', value: (p.profileViews ?? 0).toLocaleString(), color: 'text-blue-400' },
            { icon: Heart, label: 'Likes', value: (p.likesReceived ?? 0).toLocaleString(), color: 'text-[#DC143C]' },
            { icon: Camera, label: 'Photos', value: String(photos.length), color: 'text-purple-400' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="py-4 text-center">
              <Icon size={16} className={`${color} mx-auto mb-1`} />
              <p className="text-white font-bold text-lg leading-none">{value}</p>
              <p className="text-white/60 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── MAIN CONTENT ─────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">

          {/* Bio */}
          {p.bio && (
            <div className="glass rounded-2xl p-6">
              <h2 className="font-serif text-lg font-bold text-white mb-3 flex items-center gap-2">
                <span className="w-1 h-5 bg-[#DC143C] rounded-full inline-block" />
                {isCouple ? 'About us' : 'About Me'}
              </h2>
              <p className="text-white/75 leading-relaxed text-[15px]">{p.bio}</p>
            </div>
          )}

          {/* Couples: each partner side by side */}
          {isCouple && identity && (
            <div>
              <h2 className="font-serif text-lg font-bold text-white mb-3 flex items-center gap-2">
                <span className="w-1 h-5 bg-[#D4AF37] rounded-full inline-block" />
                The two of us
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {identity.people.map((person, i) => (
                  <PersonCard key={i} person={person} fallbackTitle={`Partner ${i + 1}`} />
                ))}
                {identity.people.length === 1 && (
                  <div className="glass rounded-2xl p-5 text-white/50 text-sm italic flex items-center">Partner 2 hasn&apos;t added their details yet</div>
                )}
              </div>
            </div>
          )}

          {/* Prompts */}
          {p.prompts && p.prompts.length > 0 && (
            <div className="space-y-4">
              {p.prompts.map((pr) => (
                <div key={pr.question} className="glass rounded-2xl p-6 border border-[#DC143C]/10">
                  <p className="text-white/65 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Quote size={12} className="text-[#DC143C]" />
                    {pr.question}
                  </p>
                  <p className="text-white font-serif text-xl leading-snug break-words">{pr.answer}</p>
                </div>
              ))}
            </div>
          )}

          {/* Daily Spark answers */}
          {(p.sparkAnswers?.length ?? 0) > 0 && (
            <SparkAnswers title="Their Spark answers" answers={p.sparkAnswers ?? []} />
          )}

          {/* Video profile */}
          {p.videoUrl && (
            <div className="glass rounded-2xl p-6">
              <h2 className="font-serif text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Video size={16} className="text-purple-400" />
                Video Profile
              </h2>
              <video
                src={p.videoUrl}
                controls
                playsInline
                preload="metadata"
                controlsList="nodownload"
                className="w-full max-h-[480px] rounded-xl bg-black"
              />
            </div>
          )}

          {/* Who they'd like to meet + what they're here for */}
          {identity && ((identity.interestedIn?.length ?? 0) > 0 || identity.intentions.length > 0) && (
            <div className="glass rounded-2xl p-6 space-y-4">
              {(identity.interestedIn?.length ?? 0) > 0 && (
                <div>
                  <h2 className="font-serif text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <Heart size={16} className="text-[#DC143C]" />
                    {isCouple ? 'We’d like to meet' : 'Would like to meet'}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {identity.interestedIn!.map((tag) => (
                      <span key={tag} className="bg-[#DC143C]/10 border border-[#DC143C]/25 text-[#FF4D6D] px-4 py-1.5 rounded-full text-sm font-medium">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {identity.intentions.length > 0 && (
                <div>
                  <h2 className="font-serif text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <Flame size={16} className="text-[#D4AF37]" />
                    Here for
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {identity.intentions.map((tag) => (
                      <span key={tag} className="bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#D4AF37] px-4 py-1.5 rounded-full text-sm font-medium">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Interests */}
          {p.interests && p.interests.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <h2 className="font-serif text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Zap size={16} className="text-[#D4AF37]" />
                Interests & Vibes
              </h2>
              <div className="flex flex-wrap gap-2">
                {p.interests.map((interest) => (
                  <span key={interest} className={`glass border px-4 py-1.5 rounded-full text-sm transition-colors ${sharedSet.has(interest.toLowerCase()) ? 'border-[#D4AF37]/50 text-[#D4AF37]' : 'border-white/10 hover:border-white/20 text-white/70'}`}>
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Photo Gallery */}
          {photos.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <h2 className="font-serif text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Camera size={16} className="text-[#DC143C]" />
                Photo Gallery
                <span className="text-white/55 text-sm font-normal ml-auto">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {photos.map((photo, i) => (
                  <button
                    key={photo.id}
                    onClick={() => setLightboxIdx(i)}
                    className={`relative overflow-hidden rounded-xl group ${i === 0 ? 'col-span-2 sm:col-span-2 row-span-2 aspect-[4/3]' : 'aspect-square'}`}
                  >
                    <ProtectedImage src={photo.url} alt={`${displayName} — photo ${i + 1}`} className="w-full h-full" watermark={session?.user?.email ?? 'hush'} />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Eye size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Albums (public, and private ones shown locked with "Request access") */}
          {session?.user && <MemberAlbums username={username} />}
        </div>

        {/* ─── SIDEBAR ──────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Compatibility */}
          {compatScore !== undefined && (
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-white/65 text-xs font-medium uppercase tracking-wider mb-4">Compatibility</p>
            <div className="relative w-32 h-32 mx-auto mb-3">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke="url(#compGrad)"
                  strokeWidth="10"
                  strokeDasharray={`${compatScore * 2.51} ${100 * 2.51}`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="compGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#DC143C" />
                    <stop offset="100%" stopColor="#D4AF37" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-white leading-none">{compatScore}</span>
                <span className="text-white/60 text-xs mt-0.5">% match</span>
              </div>
            </div>
            {p.insightsLocked ? (
              <Link href="/upgrade" className="block mt-4 text-xs text-purple-300 hover:text-purple-200 border border-purple-500/25 bg-purple-500/10 rounded-xl px-3 py-2 transition-colors">
                <Star size={11} className="inline -mt-0.5 mr-1" />
                See why you match with Platinum
              </Link>
            ) : (p.compatibilityReasons ?? []).length > 0 ? (
              <ul className="space-y-1.5 text-left mt-4">
                {(p.compatibilityReasons ?? []).map((r) => (
                  <li key={r} className="flex items-center gap-2 text-sm text-white/70">
                    <Sparkles size={12} className="text-[#D4AF37] flex-shrink-0" />{r}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-white/60 text-xs">Add interests, who you&apos;d like to meet and what you&apos;re here for to improve your matches</p>
            )}
            {(p.sharedInterests ?? []).length > 0 && (
              <div className="mt-4 text-left">
                <p className="text-white/60 text-xs mb-2">You both like</p>
                <div className="flex flex-wrap gap-1.5">
                  {(p.sharedInterests ?? []).map((i) => (
                    <span key={i} className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] px-2.5 py-1 rounded-full text-xs">{i}</span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-white/55 text-[11px] mt-4">Based on mutual interest, shared interests &amp; intentions, age and distance</p>
          </div>
          )}

          {/* Profile details (individuals: their own; couples: shared bits — partner details are above) */}
          {(() => {
            const rows: { label: string; value?: string }[] = [
              ...(self ? [
                { label: 'Gender', value: [self.gender, self.genderLabel].filter(Boolean).join(' · ') || undefined },
                { label: 'Orientation', value: self.orientation },
                { label: 'Height', value: self.height },
                { label: 'Body type', value: self.bodyType },
                { label: 'Ethnicity', value: self.ethnicity },
                { label: 'Languages', value: self.languages?.join(', ') },
                { label: 'Drinks', value: self.drinking },
                { label: 'Smokes', value: self.smoking },
              ] : []),
              { label: 'Children', value: identity?.children },
              { label: 'Status', value: p.relationshipStatus ? (STATUS_LABELS[p.relationshipStatus] ?? p.relationshipStatus) : undefined },
              { label: 'Location', value: location !== 'Unknown location' ? location : undefined },
              { label: 'Distance', value: p.distance },
            ];
            const shown = rows.filter((r) => !!r.value);
            return (
              <div className="glass rounded-2xl p-6">
                <p className="text-white/65 text-xs font-medium uppercase tracking-wider mb-4">Details</p>
                {shown.length > 0 ? (
                  <dl className="space-y-3">
                    {shown.map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between gap-2 text-sm">
                        <dt className="text-white/60 flex-shrink-0">{label}</dt>
                        <dd className="text-white/80 text-right break-words min-w-0">{value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-white/45 text-xs text-center italic">No details shared yet</p>
                )}
              </div>
            );
          })()}

          {/* Upgrade CTA — only for non-premium viewer */}
          {session && (
            <div className="glass rounded-2xl p-6 border border-[#D4AF37]/15 bg-gradient-to-b from-[#D4AF37]/5 to-transparent">
              <Crown size={22} className="text-[#D4AF37] mb-3" />
              <h3 className="text-white font-bold mb-1.5">Unlock More</h3>
              <p className="text-white/65 text-xs mb-4 leading-relaxed">See who liked you, send unlimited messages and get priority in search results.</p>
              <Link
                href="/upgrade"
                className="block text-center bg-gradient-to-r from-[#D4AF37] to-[#B8960C] hover:from-[#F4D03F] hover:to-[#D4AF37] text-[#0A0A0F] py-2.5 rounded-xl text-sm font-bold transition-all"
              >
                View Plans
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ─── LIGHTBOX ─────────────────────────────────────────────────── */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95" onClick={() => setLightboxIdx(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 glass rounded-full flex items-center justify-center text-white/60 hover:text-white z-10" onClick={() => setLightboxIdx(null)} aria-label="Close">
            <X size={20} />
          </button>
          {lightboxIdx > 0 && (
            <button className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 glass rounded-full flex items-center justify-center text-white/60 hover:text-white z-10" onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => i! - 1); }} aria-label="Previous">
              <ChevronLeft size={20} />
            </button>
          )}
          {lightboxIdx < photos.length - 1 && (
            <button className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 glass rounded-full flex items-center justify-center text-white/60 hover:text-white z-10" onClick={(e) => { e.stopPropagation(); setLightboxIdx(i => i! + 1); }} aria-label="Next">
              <ChevronRight size={20} />
            </button>
          )}
          <div className="max-w-[90vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <ProtectedImage src={photos[lightboxIdx].url} alt={`Photo ${lightboxIdx + 1}`} className="max-w-[90vw] max-h-[85vh] rounded-2xl shadow-2xl" watermark={session?.user?.email ?? 'hush'} />
            <p className="text-white/60 text-xs text-center mt-3">{lightboxIdx + 1} / {photos.length}</p>
          </div>
        </div>
      )}

      {/* ─── REPORT MODAL ─────────────────────────────────────────────── */}
      {showReportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
          <div className="glass rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Report {displayName}</h3>
              <button onClick={() => { setShowReportModal(false); setReportSubmitted(false); }} className="text-white/60 hover:text-white"><X size={20} /></button>
            </div>
            {reportSubmitted ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Shield size={24} className="text-emerald-400" />
                </div>
                <p className="text-white font-semibold mb-1">Report Submitted</p>
                <p className="text-white/65 text-sm">Our team will review within 24 hours.</p>
                <button onClick={() => { setShowReportModal(false); setReportSubmitted(false); }} className="mt-4 glass px-6 py-2 rounded-xl text-white/70 hover:text-white text-sm transition-colors">Close</button>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {REPORT_REASONS.map((reason) => (
                    <label key={reason} className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all border ${reportReason === reason ? 'bg-[#DC143C]/20 border-[#DC143C]/60 text-white' : 'border-white/10 text-white/60 hover:border-white/20'}`}>
                      <input type="radio" name="report_reason" value={reason} checked={reportReason === reason} onChange={() => setReportReason(reason)} className="sr-only" />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${reportReason === reason ? 'border-[#DC143C]' : 'border-white/30'}`}>
                        {reportReason === reason && <div className="w-2 h-2 rounded-full bg-[#DC143C]" />}
                      </div>
                      <span className="text-sm">{reason}</span>
                    </label>
                  ))}
                </div>
                <textarea value={reportNote} onChange={(e) => setReportNote(e.target.value)} placeholder="Additional details (optional)..." className="input-dark w-full px-4 py-3 rounded-xl text-sm resize-none mb-4" rows={3} />
                <div className="flex gap-3">
                  <button onClick={() => setShowReportModal(false)} className="flex-1 glass py-2.5 rounded-xl text-white/60 hover:text-white text-sm">Cancel</button>
                  <button onClick={handleReport} disabled={!reportReason || reportSubmitting} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40">
                    {reportSubmitting ? 'Submitting…' : 'Submit Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
