'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin, Shield, Eye, Heart, MessageCircle, Flag, Crown, Star, Camera, X, Check,
  Zap, Calendar, UserCheck, Flame, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { ReactElement } from 'react';
import type { Session } from 'next-auth';
import ProtectedImage from '@/components/ProtectedImage';

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
  orientation?: string;
  lookingFor?: string[];
  interests?: string[];
  photos?: Photo[];
  profileViews?: number;
  likesReceived?: number;
  gender?: string;
  relationshipStatus?: string;
  height?: string;
  languages?: string;
  memberSince?: string;
  compatibilityScore?: number;
}

interface Props {
  username: string;
  profile: { user?: Profile & { photos?: Photo[]; profile?: Profile } } | null;
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
  const [reportReason, setReportReason] = useState('');
  const [reportNote, setReportNote] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [messagingLoading, setMessagingLoading] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Profile data can come nested under `user` from the API
  const p: Profile = (raw as { user?: Profile & { photos?: Photo[]; profile?: Profile } } | null)?.user ?? (raw as unknown as Profile) ?? {};
  const photos: Photo[] = ((raw as { user?: { photos?: Photo[] } })?.user?.photos ?? (p.photos ?? [])).filter((ph) => !ph.isPrivate);

  const displayName = p.displayName || username.replace(/_/g, ' ');
  const initials = displayName.slice(0, 2).toUpperCase();
  const location = [p.city, p.country].filter(Boolean).join(', ') || 'Unknown location';
  const tier = p.membershipTier ?? 'FREE';
  const heroPhoto = photos.find(ph => ph.isProfile) ?? photos[0];
  const compatScore = p.compatibilityScore ?? Math.floor(65 + (username.charCodeAt(0) % 30));

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
      <div className="relative min-h-[60vh] flex flex-col justify-end overflow-hidden">
        {/* Background blurred photo */}
        {heroPhoto ? (
          <div className="absolute inset-0">
            <ProtectedImage src={heroPhoto.url} alt="" className="w-full h-full object-cover" watermark="" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/70 to-black/20" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#1A0007] via-[#100008] to-[#0A0A0F]">
            <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(220,20,60,0.25) 0%, transparent 60%)' }} />
          </div>
        )}

        <div className="relative max-w-5xl mx-auto px-4 pb-8 w-full">
          <div className="flex flex-col sm:flex-row items-end sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0 -mb-2">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-3xl overflow-hidden border-4 border-[#0A0A0F] shadow-2xl bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center">
                {heroPhoto ? (
                  <ProtectedImage src={heroPhoto.url} alt={displayName} className="w-full h-full" watermark={session?.user?.email ?? 'velour'} />
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
                <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white drop-shadow-lg">{displayName}</h1>
                {tier !== 'FREE' && TIER_BADGE[tier]}
                {p.isVerified && (
                  <span className="flex items-center gap-1 bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs font-bold px-2.5 py-1 rounded-full">
                    <Check size={10} strokeWidth={3} /> Verified
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-white/70 text-sm">
                <span className="flex items-center gap-1.5"><MapPin size={13} />{location}</span>
                {p.age && <span className="flex items-center gap-1.5"><Calendar size={13} />{p.age} years old</span>}
                {p.isOnline
                  ? <span className="flex items-center gap-1.5 text-emerald-400"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Online now</span>
                  : p.memberSince && <span className="flex items-center gap-1.5"><UserCheck size={13} />Since {p.memberSince}</span>
                }
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mt-6">
            <button
              onClick={handleMessage}
              disabled={messagingLoading}
              className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 text-sm shadow-lg shadow-[#DC143C]/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
            >
              {messagingLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <MessageCircle size={16} />}
              Send Message
            </button>
            <button
              onClick={handleLike}
              className={`glass border px-5 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 ${liked ? 'border-[#DC143C]/70 bg-[#DC143C]/15 text-[#DC143C]' : 'border-white/20 hover:border-[#DC143C]/40 text-white'}`}
            >
              <Heart size={16} className={liked ? 'fill-current' : ''} />
              {liked ? 'Liked!' : 'Like'}
            </button>
            <button
              onClick={handleSuperLike}
              className={`glass border px-5 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 ${superLiked ? 'border-[#D4AF37]/70 bg-[#D4AF37]/15 text-[#D4AF37]' : 'border-white/20 hover:border-[#D4AF37]/40 text-white'}`}
            >
              <Star size={16} className={superLiked ? 'fill-current' : ''} />
              Super Like
            </button>
            <button
              onClick={handleWink}
              className={`glass border px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 transition-all hover:scale-105 active:scale-95 ${winked ? 'border-amber-400/60 bg-amber-500/10 text-amber-400' : 'border-white/20 text-white/70 hover:text-white'}`}
            >
              👋 {winked ? 'Winked!' : 'Wink'}
            </button>
            <button
              onClick={() => setShowReportModal(true)}
              className="glass px-4 py-3 rounded-xl text-white/30 hover:text-red-400 text-sm transition-all ml-auto"
              aria-label="Report member"
            >
              <Flag size={16} />
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
              <p className="text-white/40 text-xs mt-0.5">{label}</p>
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
                About Me
              </h2>
              <p className="text-white/75 leading-relaxed text-[15px]">{p.bio}</p>
            </div>
          )}

          {/* Looking For */}
          {p.lookingFor && p.lookingFor.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <h2 className="font-serif text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Flame size={16} className="text-[#DC143C]" />
                Looking For
              </h2>
              <div className="flex flex-wrap gap-2">
                {p.lookingFor.map((tag) => (
                  <span key={tag} className="flex items-center gap-1.5 bg-[#DC143C]/10 border border-[#DC143C]/25 text-[#DC143C] px-4 py-1.5 rounded-full text-sm font-medium">
                    <Heart size={11} className="fill-current" /> {tag}
                  </span>
                ))}
              </div>
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
                  <span key={interest} className="glass border border-white/10 hover:border-white/20 px-4 py-1.5 rounded-full text-white/70 text-sm transition-colors">
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
                <span className="text-white/30 text-sm font-normal ml-auto">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {photos.map((photo, i) => (
                  <button
                    key={photo.id}
                    onClick={() => setLightboxIdx(i)}
                    className={`relative overflow-hidden rounded-xl group ${i === 0 ? 'col-span-2 sm:col-span-2 row-span-2 aspect-[4/3]' : 'aspect-square'}`}
                  >
                    <ProtectedImage src={photo.url} alt={`Photo ${i + 1}`} className="w-full h-full" watermark={session?.user?.email ?? 'velour'} />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Eye size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── SIDEBAR ──────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* Compatibility */}
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-4">Compatibility</p>
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
                <span className="text-white/40 text-xs mt-0.5">% match</span>
              </div>
            </div>
            <p className="text-white/40 text-xs">Based on shared interests &amp; preferences</p>
          </div>

          {/* Profile details */}
          <div className="glass rounded-2xl p-6">
            <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-4">Details</p>
            <div className="space-y-3">
              {[
                { label: 'Gender',       value: p.gender },
                { label: 'Orientation',  value: p.orientation },
                { label: 'Status',       value: p.relationshipStatus },
                { label: 'Height',       value: p.height },
                { label: 'Languages',    value: p.languages },
                { label: 'Location',     value: location !== 'Unknown location' ? location : null },
              ].filter(r => !!r.value).map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-white/40 flex-shrink-0">{label}</span>
                  <span className="text-white/80 text-right">{value}</span>
                </div>
              ))}
              {[
                p.gender, p.orientation, p.relationshipStatus, p.height, p.languages,
              ].every(v => !v) && (
                <p className="text-white/25 text-xs text-center italic">No details shared yet</p>
              )}
            </div>
          </div>

          {/* Upgrade CTA — only for non-premium viewer */}
          {session && (
            <div className="glass rounded-2xl p-6 border border-[#D4AF37]/15 bg-gradient-to-b from-[#D4AF37]/5 to-transparent">
              <Crown size={22} className="text-[#D4AF37] mb-3" />
              <h3 className="text-white font-bold mb-1.5">Unlock More</h3>
              <p className="text-white/50 text-xs mb-4 leading-relaxed">See who liked you, send unlimited messages and get priority in search results.</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95" onClick={() => setLightboxIdx(null)}>
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
            <ProtectedImage src={photos[lightboxIdx].url} alt={`Photo ${lightboxIdx + 1}`} className="max-w-[90vw] max-h-[85vh] rounded-2xl shadow-2xl" watermark={session?.user?.email ?? 'velour'} />
            <p className="text-white/40 text-xs text-center mt-3">{lightboxIdx + 1} / {photos.length}</p>
          </div>
        </div>
      )}

      {/* ─── REPORT MODAL ─────────────────────────────────────────────── */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
          <div className="glass rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Report {displayName}</h3>
              <button onClick={() => { setShowReportModal(false); setReportSubmitted(false); }} className="text-white/40 hover:text-white"><X size={20} /></button>
            </div>
            {reportSubmitted ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Shield size={24} className="text-emerald-400" />
                </div>
                <p className="text-white font-semibold mb-1">Report Submitted</p>
                <p className="text-white/50 text-sm">Our team will review within 24 hours.</p>
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
