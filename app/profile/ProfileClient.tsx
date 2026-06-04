'use client';

import { useState, useRef } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  Camera, Eye, Heart, MessageCircle, Users, Crown, Shield,
  Edit2, Check, X, Trash2, Lock, Plus, Star
} from 'lucide-react';
import type { Session } from 'next-auth';

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
}

interface Props {
  session: Session;
  initialProfile: Profile | null;
}

const TIER_COLORS = {
  FREE: 'text-white/50 border-white/20',
  GOLD: 'text-[#D4AF37] border-[#D4AF37]/30 bg-[#D4AF37]/10',
  PLATINUM: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
};

export default function ProfileClient({ session, initialProfile }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<Profile>(initialProfile || {});
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
  const completeness = profile.completeness ?? 60;
  const photos: Photo[] = profile.photos || [];

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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const { url } = await uploadRes.json();

      const photoRes = await fetch('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, filename: file.name }),
      });
      if (photoRes.ok) {
        const newPhoto = await photoRes.json();
        setProfile((p) => ({ ...p, photos: [...(p.photos || []), newPhoto] }));
      }
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function setAsProfile(photoId: string) {
    try {
      await fetch(`/api/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isProfile: true }),
      });
      setProfile((p) => ({
        ...p,
        photos: (p.photos || []).map((ph) => ({ ...ph, isProfile: ph.id === photoId })),
      }));
    } catch { /* ignore */ }
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
        <div className="bg-gradient-to-b from-[#1A0007] to-[#0A0A0F] py-12 px-4 border-b border-white/5">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity group"
                onClick={() => fileInputRef.current?.click()}>
                {photos.find((p) => p.isProfile)?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos.find((p) => p.isProfile)!.url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-4xl font-bold font-serif">{name.slice(0, 2).toUpperCase()}</span>
                )}
                <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera size={24} className="text-white" />
                </div>
              </div>
              <button
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#DC143C] rounded-full flex items-center justify-center hover:bg-[#FF1744] transition-colors"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Change photo"
              >
                <Camera size={14} className="text-white" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 mb-1">
                {editingFields ? (
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="input-dark font-serif text-2xl font-bold text-white px-3 py-1 rounded-lg"
                  />
                ) : (
                  <h1 className="font-serif text-3xl font-bold text-white">{name}</h1>
                )}
                <div className={`flex items-center gap-1 border px-3 py-1 rounded-full ${TIER_COLORS[tier]}`}>
                  {tier === 'GOLD' && <Crown size={12} />}
                  {tier === 'PLATINUM' && <Star size={12} />}
                  <span className="text-xs font-bold">{tier} Member</span>
                </div>
                <div className="flex items-center gap-1 glass px-3 py-1 rounded-full">
                  <Shield size={12} className="text-emerald-400" />
                  <span className="text-emerald-400 text-xs font-semibold">Verified</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                {editingFields ? (
                  <div className="flex items-center gap-2">
                    <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="input-dark text-sm px-3 py-1.5 rounded-lg w-32" />
                    <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" className="input-dark text-sm px-3 py-1.5 rounded-lg w-24" />
                    <button onClick={saveFields} disabled={saving} className="w-8 h-8 bg-[#DC143C] rounded-lg flex items-center justify-center hover:bg-[#FF1744] transition-colors">
                      <Check size={14} className="text-white" />
                    </button>
                    <button onClick={() => setEditingFields(false)} className="w-8 h-8 glass rounded-lg flex items-center justify-center text-white/50 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-white/50 text-sm">@{username} · {city || 'Add city'}, {country || 'Add country'}</p>
                    <button onClick={() => setEditingFields(true)} className="text-white/30 hover:text-white/60 transition-colors" aria-label="Edit profile fields">
                      <Edit2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Completeness */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-white/50">Profile Completeness</span>
                  <span className="text-[#DC143C] font-semibold">{completeness}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#DC143C] to-[#8F0D25] rounded-full transition-all" style={{ width: `${completeness}%` }} />
                </div>
                {completeness < 100 && (
                  <p className="text-white/30 text-xs mt-1">Complete your profile to get more matches</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {stats.map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="glass rounded-2xl p-4 text-center">
                <Icon className={`${color} mx-auto mb-2`} size={20} />
                <div className="text-white text-2xl font-bold mb-0.5">{value}</div>
                <div className="text-white/40 text-xs">{label}</div>
              </div>
            ))}
          </div>

          {/* Bio */}
          <div className="glass rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <MessageCircle size={16} className="text-[#DC143C]" />
                About Me
              </h2>
              {!editingBio && (
                <button onClick={() => setEditingBio(true)} className="text-white/30 hover:text-white/60 transition-colors" aria-label="Edit bio">
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
                  <span className="text-white/30 text-xs">{bio.length}/500</span>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingBio(false)} className="glass px-3 py-1.5 rounded-lg text-white/50 hover:text-white text-xs transition-colors">Cancel</button>
                    <button onClick={saveBio} disabled={saving} className="bg-[#DC143C] hover:bg-[#FF1744] text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60">
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-white/60 text-sm leading-relaxed">
                {bio || <span className="text-white/30 italic">No bio yet. Click the edit button to add one.</span>}
              </p>
            )}
          </div>

          {/* Photos */}
          <div className="glass rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Camera size={16} className="text-[#DC143C]" />
                My Photos
              </h2>
              <span className="text-white/30 text-xs">{photos.length}/9 photos</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="Photo" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                    <button
                      onClick={() => setAsProfile(photo.id)}
                      className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors w-full text-center ${photo.isProfile ? 'bg-[#DC143C] text-white' : 'glass text-white/70 hover:text-white'}`}
                    >
                      {photo.isProfile ? '✓ Profile' : 'Set Profile'}
                    </button>
                    <button
                      onClick={() => togglePrivate(photo.id, photo.isPrivate)}
                      className="text-xs glass px-2 py-1 rounded-lg text-white/70 hover:text-white w-full text-center"
                    >
                      {photo.isPrivate ? '🔓 Make Public' : '🔒 Make Private'}
                    </button>
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      className="text-xs bg-red-500/20 hover:bg-red-500/40 text-red-400 px-2 py-1 rounded-lg w-full text-center"
                    >
                      Delete
                    </button>
                  </div>
                  {photo.isProfile && (
                    <div className="absolute bottom-2 left-2 bg-[#DC143C]/80 px-1.5 py-0.5 rounded text-xs text-white font-semibold">Main</div>
                  )}
                  {photo.isPrivate && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center">
                      <Lock size={10} className="text-white/70" />
                    </div>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="aspect-square rounded-xl border-2 border-dashed border-white/10 hover:border-[#DC143C]/40 flex flex-col items-center justify-center gap-2 transition-all hover:bg-white/5"
                aria-label="Add photo"
              >
                {uploadingPhoto ? (
                  <div className="w-6 h-6 border-2 border-[#DC143C] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus size={20} className="text-white/20" />
                    <span className="text-white/20 text-xs">Add Photo</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-white/30 text-xs mt-3">JPEG, PNG, WEBP accepted. Max 10MB each. Hover a photo to manage it.</p>
          </div>

          {/* Membership Tier */}
          <div className={`glass rounded-2xl p-6 mb-6 ${tier === 'FREE' ? 'border border-[#DC143C]/20' : ''}`}>
            <h2 className="text-white font-semibold flex items-center gap-2 mb-4">
              <Crown size={16} className="text-[#D4AF37]" />
              Membership
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold capitalize">{tier} Tier</p>
                <p className="text-white/40 text-sm mt-0.5">
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
        </div>
      </main>

      <Footer />
    </div>
  );
}
