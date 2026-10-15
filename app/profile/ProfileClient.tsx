'use client';

import { useState, useRef } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProtectedImage from '@/components/ProtectedImage';
import {
  Camera, Eye, Heart, MessageCircle, Users, Crown, Shield,
  Edit2, Check, X, Trash2, Lock, Star,
  Globe, Upload
} from 'lucide-react';
import type { Session } from 'next-auth';
import { CITIES_BY_COUNTRY, COUNTRIES } from '@/lib/cities';
import BoostCard from './BoostCard';
import { PromptsEditor, VideoProfileCard, LocationCard, PrivacySettingsCard } from './ProfileExtras';
import IdentityEditor, { type IdentityInitial } from './IdentityEditor';
import CoupleLinkCard from './CoupleLinkCard';
import type { ProfilePrompt } from './prompts';
import ProfileStrength from './ProfileStrength';
import type { StrengthFacts } from './strength';
import StatusControl from '@/components/status/StatusControl';
import type { ActiveStatus } from '@/components/status/status';
import BadgeGrid from '@/components/badges/BadgeGrid';
import BadgeRow from '@/components/badges/BadgeRow';
import SparkAnswers, { type SparkAnswerView } from '@/components/spark/SparkAnswers';
import type { Badge } from '@/lib/badges';
import Link from 'next/link';
import MyReviewsPanel from '@/components/reviews/MyReviewsPanel';
import ProfilePhotoPicker from './ProfilePhotoPicker';

interface Photo {
  id: string;
  url: string;
  isProfile: boolean;
  isPrivate: boolean;
}

interface Profile {
  id?: string;
  displayName?: string;
  username?: string;
  isVerified?: boolean;
  bio?: string;
  city?: string;
  country?: string;
  orientation?: string;
  lookingFor?: string[];
  membershipTier?: 'FREE' | 'GOLD' | 'PLATINUM';
  photos?: Photo[];
  profileViews?: number;
  likesReceived?: number;
  matches?: number;
  messageCount?: number;
  completeness?: number;
  isCouple?: boolean;
  partnerId?: string | null;
  prompts?: ProfilePrompt[];
  videoUrl?: string | null;
  incognito?: boolean;
  showChatImages?: boolean;
  hasLocation?: boolean;
  isPaid?: boolean;
  isPlatinum?: boolean;
  identity?: IdentityInitial;
  pronouns?: string | null;
  status?: ActiveStatus | null;
  badges?: Badge[];
  strength?: StrengthFacts;
  sparkAnswers?: SparkAnswerView[];
}

interface Props {
  session: Session;
  initialProfile: Profile | null;
}

const TIER_COLORS = {
  FREE: 'text-white/65 border-white/20',
  GOLD: 'text-[#D4AF37] border-[#D4AF37]/30 bg-[#D4AF37]/10',
  PLATINUM: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
};

export default function ProfileClient({ session, initialProfile }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const privateFileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [profile, setProfile] = useState<Profile>(initialProfile || {});
  const [photoTab, setPhotoTab] = useState<'public' | 'private'>('public');
  const [editingBio, setEditingBio] = useState(false);
  const [bio, setBio] = useState(initialProfile?.bio || '');
  const [editingFields, setEditingFields] = useState(false);
  const [displayName, setDisplayName] = useState(initialProfile?.displayName || '');
  const [city, setCity] = useState(initialProfile?.city || '');
  const [country, setCountry] = useState(initialProfile?.country || '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const user = session.user as { username?: string; name?: string; email?: string };
  const username = profile.username || user.username || user.email?.split('@')[0] || 'User';
  const name = profile.displayName || displayName || user.name || username;
  const tier = profile.membershipTier || 'FREE';
  const photos: Photo[] = profile.photos || [];
  // Earned badges for the header row (Verified already has its own pill; one Spark tier only).
  const headerBadges = (() => {
    const earned = (profile.badges ?? []).filter((b) => b.earned && b.id !== 'verified');
    const top = ['spark_30', 'spark_7', 'spark_3'].find((id) => earned.some((b) => b.id === id));
    return earned.filter((b) => !b.id.startsWith('spark_') || b.id === top);
  })();

  async function saveBio() {
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio }),
      });
      if (res.ok) {
        setProfile((p) => ({ ...p, bio }));
        setEditingBio(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveFields() {
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, city, country }),
      });
      if (res.ok) {
        setProfile((p) => ({ ...p, displayName, city, country }));
        setEditingFields(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>, isPrivate = false, asProfile = false) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setPhotoError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!uploadRes.ok) {
        const body = await uploadRes.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || 'Upload failed. Please try a different photo.');
      }
      const { url } = await uploadRes.json() as { url: string };

      const photoRes = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, isPrivate, isProfile: asProfile && !isPrivate }),
      });
      if (!photoRes.ok) {
        const body = await photoRes.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || 'Could not save your photo. Please try again.');
      }
      const { photo: newPhoto } = await photoRes.json() as { photo: Photo };
      setProfile((p) => ({
        ...p,
        photos: [
          ...(p.photos || []).map((ph) => (newPhoto.isProfile ? { ...ph, isProfile: false } : ph)),
          newPhoto,
        ],
      }));
      setPhotoTab(isPrivate ? 'private' : 'public');
      if (asProfile) setPhotoPickerOpen(false);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (privateFileInputRef.current) privateFileInputRef.current.value = '';
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }

  async function setAsProfile(photoId: string): Promise<boolean> {
    setPhotoError('');
    try {
      const res = await fetch(`/api/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isProfile: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setPhotoError(body.error || 'Could not change your profile photo.');
        return false;
      }
      setProfile((p) => ({
        ...p,
        photos: (p.photos || []).map((ph) => ({ ...ph, isProfile: ph.id === photoId })),
      }));
      return true;
    } catch {
      setPhotoError('Could not change your profile photo.');
      return false;
    }
  }

  function openPhotoPicker() {
    setPhotoError('');
    if (photos.some((p) => !p.isPrivate)) setPhotoPickerOpen(true);
    else avatarInputRef.current?.click();
  }

  async function togglePrivate(photoId: string, current: boolean) {
    try {
      await fetch(`/api/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrivate: !current }),
      });
      setProfile((p) => ({
        ...p,
        photos: (p.photos || []).map((ph) => ph.id === photoId ? { ...ph, isPrivate: !current } : ph),
      }));
    } catch { /* ignore */ }
  }

  async function deletePhoto(photoId: string) {
    try {
      await fetch(`/api/photos/${photoId}`, { method: 'DELETE' });
      setProfile((p) => ({ ...p, photos: (p.photos || []).filter((ph) => ph.id !== photoId) }));
    } catch { /* ignore */ }
  }

  const stats = [
    { icon: Eye, label: 'Profile Views', value: (profile.profileViews ?? 0).toLocaleString(), color: 'text-blue-400' },
    { icon: Heart, label: 'Likes Received', value: (profile.likesReceived ?? 0).toLocaleString(), color: 'text-[#DC143C]' },
    { icon: Users, label: 'Matches', value: (profile.matches ?? 0).toLocaleString(), color: 'text-emerald-400' },
    { icon: MessageCircle, label: 'Messages', value: (profile.messageCount ?? 0).toLocaleString(), color: 'text-purple-400' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />

      <main className="pt-16">
        {/* Header */}
        <div id="profile-header" className="bg-gradient-to-b from-[#1A0007] to-[#0A0A0F] py-12 px-4 border-b border-white/5 scroll-mt-16">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative">
              <button
                type="button"
                className="relative w-28 h-28 rounded-2xl bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity group"
                onClick={openPhotoPicker}
                aria-label="Change profile photo"
              >
                {photos.find((p) => p.isProfile)?.url ? (
                  <ProtectedImage src={photos.find((p) => p.isProfile)!.url} alt="Profile" className="w-full h-full" />
                ) : (
                  <span className="text-white text-4xl font-bold font-serif">{name.slice(0, 2).toUpperCase()}</span>
                )}
                <span className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1" aria-hidden="true">
                  <Camera size={22} className="text-white" />
                  <span className="text-white text-[11px] font-medium">Change</span>
                </span>
                {uploadingPhoto && (
                  <span className="absolute inset-0 bg-black/60 flex items-center justify-center" aria-hidden="true">
                    <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </span>
                )}
              </button>
              <button
                type="button"
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#DC143C] rounded-full flex items-center justify-center hover:bg-[#FF1744] transition-colors"
                onClick={openPhotoPicker}
                aria-label="Change profile photo"
                title="Change profile photo"
              >
                <Camera size={14} className="text-white" />
              </button>
              {photoError && !photoPickerOpen && (
                <p role="alert" className="absolute top-full mt-3 left-1/2 -translate-x-1/2 w-56 text-center text-xs text-red-300">{photoError}</p>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 mb-1">
                {editingFields ? (
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    aria-label="Display name"
                    className="input-dark font-serif text-2xl font-bold text-white px-3 py-1 rounded-lg"
                  />
                ) : (
                  <h1 className="font-serif text-3xl font-bold text-white break-words">
                    {name}
                    {profile.pronouns && !profile.isCouple && <span className="text-white/60 text-base font-sans font-normal ml-2">({profile.pronouns})</span>}
                  </h1>
                )}
                <div className={`flex items-center gap-1 border px-3 py-1 rounded-full ${TIER_COLORS[tier]}`}>
                  {tier === 'GOLD' && <Crown size={12} />}
                  {tier === 'PLATINUM' && <Star size={12} />}
                  <span className="text-xs font-bold">{tier.charAt(0) + tier.slice(1).toLowerCase()} member</span>
                </div>
                {profile.isVerified && (
                  <div className="flex items-center gap-1 glass px-3 py-1 rounded-full">
                    <Shield size={12} className="text-emerald-400" />
                    <span className="text-emerald-400 text-xs font-semibold">Verified</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mb-4">
                {editingFields ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={country}
                      onChange={(e) => { setCountry(e.target.value); setCity(''); }}
                      aria-label="Country"
                      className="input-dark text-sm px-3 py-1.5 rounded-lg"
                    >
                      <option value="">Country</option>
                      {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      aria-label="City"
                      className="input-dark text-sm px-3 py-1.5 rounded-lg"
                      disabled={!country}
                    >
                      <option value="">City</option>
                      {(CITIES_BY_COUNTRY[country] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={saveFields} disabled={saving} aria-label="Save" className="w-8 h-8 bg-[#DC143C] rounded-lg flex items-center justify-center hover:bg-[#FF1744] transition-colors">
                      <Check size={14} className="text-white" />
                    </button>
                    <button onClick={() => setEditingFields(false)} aria-label="Cancel" className="w-8 h-8 glass rounded-lg flex items-center justify-center text-white/65 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-white/65 text-sm">@{username} · {city || 'Add city'}, {country || 'Add country'}</p>
                    <button onClick={() => setEditingFields(true)} className="text-white/55 hover:text-white/60 transition-colors" aria-label="Edit profile fields">
                      <Edit2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Status ("Free tonight 🍷") + earned badges */}
              <StatusControl initial={profile.status ?? null} className="mb-3" />
              {headerBadges.length > 0 && (
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <BadgeRow badges={headerBadges} max={4} className="justify-center sm:justify-start" />
                  <a href="#badges" className="text-xs text-white/55 hover:text-white">All badges</a>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Profile strength (identity completeness + photos, prompts & more) */}
          {profile.strength && (
            <ProfileStrength facts={{ ...profile.strength, publicPhotos: photos.filter((p) => !p.isPrivate).length }} />
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {stats.map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="glass rounded-2xl p-4 text-center">
                <Icon className={`${color} mx-auto mb-2`} size={20} />
                <div className="text-white text-2xl font-bold mb-0.5">{value}</div>
                <div className="text-white/60 text-xs">{label}</div>
              </div>
            ))}
          </div>

          {/* Bio */}
          <div id="bio" className="glass rounded-2xl p-6 mb-6 scroll-mt-24">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <MessageCircle size={16} className="text-[#DC143C]" />
                {profile.isCouple ? 'Our bio' : 'My bio'}
              </h2>
              {!editingBio && (
                <button onClick={() => setEditingBio(true)} className="text-white/55 hover:text-white/60 transition-colors" aria-label="Edit bio">
                  <Edit2 size={14} />
                </button>
              )}
            </div>
            {editingBio ? (
              <div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 500))}
                  className="input-dark w-full px-4 py-3 rounded-xl text-sm resize-none"
                  rows={5}
                  placeholder="Tell potential matches about yourself..."
                  aria-label="Bio"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-white/55 text-xs">{bio.length}/500</span>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingBio(false)} className="glass px-3 py-1.5 rounded-lg text-white/65 hover:text-white text-xs transition-colors">Cancel</button>
                    <button onClick={saveBio} disabled={saving} className="bg-[#DC143C] hover:bg-[#FF1744] text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60">
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-white/60 text-sm leading-relaxed">
                {bio || <span className="text-white/55 italic">No bio yet. Click the edit button to add one.</span>}
              </p>
            )}
          </div>

          {/* Identity, who you'd like to meet, about-me details (and both partners for couples) */}
          <div id="identity" className="scroll-mt-24">
            {profile.identity && <IdentityEditor initial={profile.identity} />}
          </div>

          {/* Boost */}
          <BoostCard className="mb-6" />

          {/* Prompts */}
          <div id="prompts" className="scroll-mt-24">
            <PromptsEditor initial={profile.prompts ?? []} />
          </div>

          {/* Daily Spark answers (the last few show on your profile) */}
          <SparkAnswers
            className="mb-6"
            title="Your Spark answers"
            answers={profile.sparkAnswers ?? []}
            emptyText="Answer the Daily Spark and your latest answers show here — an easy conversation starter."
            footer={
              <Link href="/spark" className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-[#FF4D6D] hover:text-[#FF85A1]">
                Go to today&apos;s Spark →
              </Link>
            }
          />

          {/* Reviews: score, requests to answer, waiting reviews, ask someone */}
          <MyReviewsPanel compact className="mb-6" />

          {/* Photos */}
          <div id="photos" className="glass rounded-2xl p-6 mb-6 scroll-mt-24">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Camera size={16} className="text-[#DC143C]" />
                My Photos
              </h2>
              <span className="text-white/55 text-xs">{photos.length}/9 photos</span>
            </div>

            {/* Folder tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setPhotoTab('public')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${photoTab === 'public' ? 'bg-[#DC143C] text-white' : 'glass text-white/65 hover:text-white'}`}
              >
                <Globe size={14} />
                Public ({photos.filter(p => !p.isPrivate).length})
              </button>
              <button
                onClick={() => setPhotoTab('private')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${photoTab === 'private' ? 'bg-white/10 text-white' : 'glass text-white/65 hover:text-white'}`}
              >
                <Lock size={14} />
                Private ({photos.filter(p => p.isPrivate).length})
              </button>
            </div>

            {photoTab === 'private' && (
              <p className="text-white/55 text-xs mb-3 flex items-center gap-1.5">
                <Lock size={10} />
                Private photos are only visible to you and people you choose to share them with.
              </p>
            )}

            <div className="grid grid-cols-3 gap-3">
              {photos.filter(p => photoTab === 'public' ? !p.isPrivate : p.isPrivate).map((photo) => (
                <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden group">
                  <ProtectedImage src={photo.url} alt="Photo" className="w-full h-full" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                    {!photo.isPrivate && (
                      <button
                        onClick={() => setAsProfile(photo.id)}
                        className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors w-full text-center ${photo.isProfile ? 'bg-[#DC143C] text-white' : 'glass text-white/70 hover:text-white'}`}
                      >
                        {photo.isProfile ? '✓ Profile Photo' : 'Set as Profile'}
                      </button>
                    )}
                    <button
                      onClick={() => togglePrivate(photo.id, photo.isPrivate)}
                      className="text-xs glass px-2 py-1 rounded-lg text-white/70 hover:text-white w-full text-center flex items-center justify-center gap-1"
                    >
                      {photo.isPrivate ? <><Globe size={10} /> Move to Public</> : <><Lock size={10} /> Move to Private</>}
                    </button>
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      className="text-xs bg-red-500/20 hover:bg-red-500/40 text-red-400 px-2 py-1 rounded-lg w-full text-center flex items-center justify-center gap-1"
                    >
                      <Trash2 size={10} /> Remove
                    </button>
                  </div>
                  {photo.isProfile && (
                    <div className="absolute bottom-2 left-2 bg-[#DC143C]/80 px-1.5 py-0.5 rounded text-xs text-white font-semibold">Main</div>
                  )}
                </div>
              ))}

              {/* Add to current folder */}
              {photos.length < 9 && (
                <button
                  type="button"
                  onClick={() => photoTab === 'private' ? privateFileInputRef.current?.click() : fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-[#DC143C]/40 flex flex-col items-center justify-center gap-2 transition-all hover:bg-white/5"
                  aria-label={`Add ${photoTab} photo`}
                >
                  {uploadingPhoto ? (
                    <div className="w-6 h-6 border-2 border-[#DC143C] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload size={20} className="text-white/45" />
                      <span className="text-white/45 text-xs">Add to {photoTab === 'private' ? 'Private' : 'Public'}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, false)} />
            <input ref={privateFileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, true)} />
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, false, true)} />
            {photoPickerOpen && (
              <ProfilePhotoPicker
                photos={photos}
                busy={uploadingPhoto}
                error={photoError}
                onUpload={() => avatarInputRef.current?.click()}
                onPick={async (id) => { if (await setAsProfile(id)) setPhotoPickerOpen(false); }}
                onClose={() => setPhotoPickerOpen(false)}
              />
            )}

            <p className="text-white/55 text-xs mt-3">JPEG, PNG, WEBP accepted. Hover a photo to manage it.</p>
          </div>

          {/* Badges */}
          {(profile.badges ?? []).length > 0 && <BadgeGrid badges={profile.badges ?? []} className="mb-6" />}

          {/* Video profile */}
          <VideoProfileCard initialUrl={profile.videoUrl ?? null} platinum={!!profile.isPlatinum} />

          {/* Location */}
          <LocationCard initialHasLocation={!!profile.hasLocation} />

          {/* Privacy */}
          <PrivacySettingsCard
            initialIncognito={!!profile.incognito}
            initialShowChatImages={!!profile.showChatImages}
            platinum={!!profile.isPlatinum}
          />

          {/* Membership Tier */}
          <div className={`glass rounded-2xl p-6 mb-6 ${tier === 'FREE' ? 'border border-[#DC143C]/20' : ''}`}>
            <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
              <Crown size={16} className="text-[#D4AF37]" />
              Membership
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold capitalize">{tier} Tier</p>
                <p className="text-white/60 text-sm mt-0.5">
                  {tier === 'FREE' && 'Upgrade to unlock unlimited messaging, advanced filters & more'}
                  {tier === 'GOLD' && 'You have access to all Gold features'}
                  {tier === 'PLATINUM' && 'You have access to all Platinum features'}
                </p>
              </div>
              {tier === 'FREE' && (
                <a href="/upgrade" className="bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] font-bold px-5 py-2.5 rounded-xl text-sm hover:from-[#F4D03F] hover:to-[#D4AF37] transition-all whitespace-nowrap">
                  Upgrade Now
                </a>
              )}
              {tier === 'GOLD' && (
                <a href="/upgrade" className="bg-gradient-to-r from-purple-600 to-purple-800 text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:from-purple-500 hover:to-purple-700 transition-all whitespace-nowrap">
                  Go Platinum
                </a>
              )}
            </div>
          </div>

          {/* Linked-accounts couples */}
          <div id="couple-link" className="scroll-mt-24">
            <CoupleLinkCard />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
