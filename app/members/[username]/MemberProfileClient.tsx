'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin, Shield, Eye, Heart, MessageCircle, Flag, Crown, Star, Camera, X, Check
} from 'lucide-react';
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
  profile: Profile | null;
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

export default function MemberProfileClient({ username, profile, session }: Props) {
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
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  const p = profile || {};
  const displayName = p.displayName || username.replace(/_/g, ' ');
  const initials = displayName.slice(0, 2).toUpperCase();
  const location = [p.city, p.country].filter(Boolean).join(', ') || 'Unknown location';
  const tier = p.membershipTier || 'FREE';
  const photos: Photo[] = (p.photos || []).filter((ph) => !ph.isPrivate);

  async function handleLike() {
    setLiked(!liked);
    try {
      await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUsername: username, type: 'LIKE' }),
      });
    } catch { /* ignore */ }
  }

  async function handleSuperLike() {
    setSuperLiked(!superLiked);
    try {
      await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUsername: username, type: 'SUPER_LIKE' }),
      });
    } catch { /* ignore */ }
  }

  async function handleWink() {
    setWinked(!winked);
    try {
      await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUsername: username, type: 'WINK' }),
      });
    } catch { /* ignore */ }
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
        router.push('/messages');
      }
    } finally {
      setMessagingLoading(false);
    }
  }

  async function handleReport() {
    if (!reportReason) return;
    setReportSubmitting(true);
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUsername: username, reason: reportReason, note: reportNote }),
      });
      setReportSubmitted(true);
    } finally {
      setReportSubmitting(false);
    }
  }

  const compatScore = p.compatibilityScore ?? 87;

  return (
    <>
      {/* Hero */}
      <div className="relative bg-gradient-to-b from-[#1A0007] to-[#0A0A0F] pt-12 pb-0 overflow-hidden">
        <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(220,20,60,0.3) 0%, transparent 70%)' }} />

        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-start gap-8 pb-8">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-36 h-36 md:w-48 md:h-48 rounded-2xl overflow-hidden bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center">
                {photos.find((ph) => ph.isProfile)?.url || photos[0]?.url ? (
                  <ProtectedImage
                    src={(photos.find((ph) => ph.isProfile) || photos[0]).url}
                    alt={displayName}
                    className="w-full h-full"
                    watermark={session?.user?.email ?? 'velour'}
                  />
                ) : (
                  <span className="text-white text-5xl md:text-6xl font-bold font-serif">{initials}</span>
                )}
              </div>
              {p.isOnline && (
                <div className="absolute -bottom-2 -right-2 flex items-center gap-1.5 bg-emerald-500 px-2 py-1 rounded-full">
                  <div className="w-2 h-2 bg-white rounded-full" />
                  <span className="text-white text-xs font-semibold">Online</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-start gap-3 mb-3">
                <h1 className="font-serif text-3xl md:text-4xl font-bold text-white">{displayName}</h1>
                {tier === 'GOLD' && (
                  <div className="flex items-center gap-1 bg-[#D4AF37]/20 border border-[#D4AF37]/30 px-3 py-1 rounded-full">
                    <Crown size={12} className="text-[#D4AF37]" />
                    <span className="text-[#D4AF37] text-xs font-bold">Gold Member</span>
                  </div>
                )}
                {tier === 'PLATINUM' && (
                  <div className="flex items-center gap-1 bg-purple-500/20 border border-purple-500/30 px-3 py-1 rounded-full">
                    <Star size={12} className="text-purple-400" />
                    <span className="text-purple-400 text-xs font-bold">Platinum Member</span>
                  </div>
                )}
                {p.isVerified && (
                  <div
                    className="flex items-center gap-1 bg-blue-500/20 border border-blue-500/40 px-3 py-1 rounded-full"
                    title="Verified Member"
                  >
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check size={9} className="text-white" strokeWidth={3} />
                    </div>
                    <span className="text-blue-400 text-xs font-semibold">Verified</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-white/60 text-sm mb-4">
                <span className="flex items-center gap-1"><MapPin size={14} />{location}</span>
                {p.age && <span>{p.age} years old</span>}
                {p.memberSince && <span>Member since {p.memberSince}</span>}
              </div>

              {p.bio && (
                <p className="text-white/70 text-sm leading-relaxed max-w-lg mb-6">{p.bio}</p>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleMessage}
                  disabled={messagingLoading}
                  className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm transition-all disabled:opacity-60"
                >
                  {messagingLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <MessageCircle size={16} />}
                  Send Message
                </button>

                <button
                  onClick={handleLike}
                  className={`glass border px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
                    liked ? 'border-[#DC143C]/60 bg-[#DC143C]/10 text-[#DC143C]' : 'border-white/20 hover:border-[#DC143C]/40 text-white'
                  }`}
                >
                  <Heart size={16} className={liked ? 'fill-current' : ''} />
                  {liked ? 'Liked' : 'Like'}
                </button>

                <button
                  onClick={handleWink}
                  className={`glass border px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
                    winked ? 'border-amber-500/60 bg-amber-500/10 text-amber-400' : 'border-white/20 hover:border-amber-500/40 text-white'
                  }`}
                >
                  👋 {winked ? 'Winked!' : 'Wink'}
                </button>

                <button
                  onClick={handleSuperLike}
                  className={`glass border px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
                    superLiked ? 'border-[#D4AF37]/60 bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-white/20 hover:border-[#D4AF37]/40 text-white'
                  }`}
                >
                  <Star size={16} className={superLiked ? 'fill-current' : ''} />
                  {superLiked ? 'Super Liked!' : 'Super Like'}
                </button>

                <button
                  onClick={() => setShowReportModal(true)}
                  className="glass px-3 py-2.5 rounded-xl text-white/40 hover:text-red-400 text-sm transition-all"
                  aria-label="Report member"
                >
                  <Flag size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 border-t border-white/5 py-4">
            {[
              { icon: Eye, label: 'Profile Views', value: (p.profileViews || 0).toLocaleString() },
              { icon: Heart, label: 'Likes', value: (p.likesReceived || 0).toLocaleString() },
              { icon: Camera, label: 'Photos', value: String(photos.length) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Icon size={14} className="text-[#DC143C]" />
                  <span className="text-white font-bold">{value}</span>
                </div>
                <p className="text-white/40 text-xs">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-8">
          {/* About */}
          {p.bio && (
            <div className="glass rounded-2xl p-6">
              <h2 className="font-serif text-xl font-bold text-white mb-4">About Me</h2>
              <p className="text-white/70 leading-relaxed">{p.bio}</p>
            </div>
          )}

          {/* Looking For */}
          {p.lookingFor && p.lookingFor.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <h2 className="font-serif text-xl font-bold text-white mb-4">Looking For</h2>
              <div className="flex flex-wrap gap-2">
                {p.lookingFor.map((tag) => (
                  <span key={tag} className="glass-crimson px-3 py-1.5 rounded-full text-[#DC143C] text-sm border border-[#DC143C]/20">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Interests */}
          {p.interests && p.interests.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <h2 className="font-serif text-xl font-bold text-white mb-4">Interests</h2>
              <div className="flex flex-wrap gap-2">
                {p.interests.map((interest) => (
                  <span key={interest} className="glass px-3 py-1.5 rounded-full text-white/70 text-sm">
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Photo Gallery */}
          {photos.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <h2 className="font-serif text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Camera size={18} className="text-[#DC143C]" />
                Photo Gallery
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo, i) => (
                  <div
                    key={photo.id}
                    onClick={() => setLightboxPhoto(photo.url)}
                    className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                    role="button"
                    tabIndex={0}
                    aria-label={`View photo ${i + 1}`}
                  >
                    <ProtectedImage src={photo.url} alt={`Photo ${i + 1}`} className="w-full h-full" watermark={session?.user?.email ?? 'velour'} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Compatibility */}
          <div className="glass rounded-2xl p-6 text-center">
            <h3 className="text-white font-semibold mb-4">Compatibility Score</h3>
            <div className="relative w-28 h-28 mx-auto mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke="#DC143C"
                  strokeWidth="8"
                  strokeDasharray={`${compatScore * 2.64} ${100 * 2.64}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-white">{compatScore}%</span>
                <span className="text-white/40 text-xs">Match</span>
              </div>
            </div>
            <p className="text-white/50 text-xs">Based on your profile and preferences</p>
          </div>

          {/* Profile Details */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4">Profile Details</h3>
            <div className="space-y-3">
              {[
                { label: 'Gender', value: p.gender },
                { label: 'Orientation', value: p.orientation },
                { label: 'Relationship', value: p.relationshipStatus },
                { label: 'Height', value: p.height },
                { label: 'Languages', value: p.languages },
                { label: 'Location', value: location },
              ].filter(({ value }) => !!value).map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-white/40">{label}</span>
                  <span className="text-white/80">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upgrade CTA */}
          <div className="glass rounded-2xl p-6 border border-[#DC143C]/20">
            <Crown size={24} className="text-[#D4AF37] mb-3" />
            <h3 className="text-white font-semibold mb-2">Unlock More</h3>
            <p className="text-white/50 text-sm mb-4">Upgrade to Gold to see who liked you and send unlimited messages.</p>
            <Link href="/upgrade" className="block text-center bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white py-2.5 rounded-xl text-sm font-semibold transition-all">
              View Plans
            </Link>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Report {displayName}</h3>
              <button onClick={() => { setShowReportModal(false); setReportSubmitted(false); }} className="text-white/40 hover:text-white transition-colors" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            {reportSubmitted ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Shield size={24} className="text-emerald-400" />
                </div>
                <p className="text-white font-semibold mb-1">Report Submitted</p>
                <p className="text-white/50 text-sm">Our team will review this report within 24 hours.</p>
                <button onClick={() => { setShowReportModal(false); setReportSubmitted(false); }} className="mt-4 glass px-6 py-2 rounded-xl text-white/70 hover:text-white text-sm transition-colors">
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="text-white/50 text-sm mb-4">Please select a reason for reporting this member.</p>
                <div className="space-y-2 mb-4">
                  {REPORT_REASONS.map((reason) => (
                    <label key={reason} className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all border ${
                      reportReason === reason ? 'bg-[#DC143C]/20 border-[#DC143C]/60 text-white' : 'border-white/10 text-white/60 hover:border-white/20'
                    }`}>
                      <input type="radio" name="report_reason" value={reason} checked={reportReason === reason} onChange={() => setReportReason(reason)} className="sr-only" />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${reportReason === reason ? 'border-[#DC143C]' : 'border-white/30'}`}>
                        {reportReason === reason && <div className="w-2 h-2 rounded-full bg-[#DC143C]" />}
                      </div>
                      <span className="text-sm">{reason}</span>
                    </label>
                  ))}
                </div>
                <textarea
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="Additional details (optional)..."
                  className="input-dark w-full px-4 py-3 rounded-xl text-sm resize-none mb-4"
                  rows={3}
                />
                <div className="flex gap-3">
                  <button onClick={() => setShowReportModal(false)} className="flex-1 glass py-2.5 rounded-xl text-white/60 hover:text-white text-sm transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleReport}
                    disabled={!reportReason || reportSubmitting}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
                  >
                    {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setLightboxPhoto(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white" aria-label="Close lightbox">
            <X size={28} />
          </button>
          <ProtectedImage src={lightboxPhoto} alt="Full size" className="max-w-[90vw] max-h-[85vh] rounded-lg" watermark={session?.user?.email ?? 'velour'} />
        </div>
      )}
    </>
  );
}
