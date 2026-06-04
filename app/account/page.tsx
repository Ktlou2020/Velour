'use client';

import { useState, useRef, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { useSession, signOut } from 'next-auth/react';
import { Shield, Download, Trash2, Camera, CheckCircle, Clock, XCircle, Flame } from 'lucide-react';

export default function AccountPage() {
  const { data: session } = useSession();
  const username = (session?.user as { username?: string })?.username ?? '';

  const [verifyStatus, setVerifyStatus] = useState<'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED'>('NONE');
  const [uploading, setUploading] = useState(false);
  const [streak, setStreak] = useState(0);
  const [superLikes, setSuperLikes] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteStep, setDeleteStep] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/verify').then(r => r.json()).then(d => setVerifyStatus(d.status ?? 'NONE')).catch(() => {});
    fetch('/api/streak').then(r => r.json()).then(d => {
      setStreak(d.streak ?? 0);
      setSuperLikes(d.superLikeCredits ?? 1);
    }).catch(() => {});
  }, []);

  async function handleVerifyUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Upload to Cloudinary
      const fd = new FormData();
      fd.append('file', file);
      fd.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? 'velour_unsigned');
      fd.append('folder', 'velour/verification');
      const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json() as { secure_url: string };
      // Submit for review
      const verRes = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: data.secure_url }),
      });
      if (verRes.ok) setVerifyStatus('PENDING');
    } catch { alert('Upload failed. Please try again.'); }
    finally { setUploading(false); }
  }

  async function handleDelete() {
    if (deleteConfirm !== 'DELETE MY ACCOUNT') return;
    setDeleting(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: deleteConfirm }),
      });
      if (res.ok) {
        await signOut({ callbackUrl: '/' });
      } else {
        const d = await res.json() as { error?: string };
        alert(d.error ?? 'Failed to delete account');
      }
    } finally { setDeleting(false); }
  }

  const verifyBadge = {
    NONE: { icon: Camera, text: 'Not verified', color: 'text-white/40' },
    PENDING: { icon: Clock, text: 'Verification pending review', color: 'text-amber-400' },
    VERIFIED: { icon: CheckCircle, text: 'Verified ✓', color: 'text-emerald-400' },
    REJECTED: { icon: XCircle, text: 'Verification rejected — try again', color: 'text-red-400' },
  }[verifyStatus];

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-24 pb-16 px-4 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-white text-2xl font-bold font-serif">Account Settings</h1>
          <p className="text-white/40 text-sm mt-1">@{username}</p>
        </div>

        {/* Streak */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Flame size={20} className="text-orange-400" />
            <h2 className="text-white font-semibold">Daily Streak</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-orange-400">{streak}</div>
              <div className="text-white/40 text-xs mt-1">day streak</div>
            </div>
            <div className="flex-1">
              <p className="text-white/60 text-sm mb-2">Log in every day to grow your streak. Every 7 days earns a free Super Like!</p>
              <div className="flex gap-1">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className={`flex-1 h-2 rounded-full ${i < (streak % 7) ? 'bg-orange-400' : 'bg-white/10'}`} />
                ))}
              </div>
              <p className="text-white/30 text-xs mt-1">{7 - (streak % 7)} days until next Super Like reward</p>
            </div>
            <div className="text-center glass rounded-xl p-3">
              <div className="text-2xl font-bold text-[#D4AF37]">{superLikes}</div>
              <div className="text-white/40 text-xs">super likes</div>
            </div>
          </div>
        </div>

        {/* Photo Verification */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield size={20} className="text-[#DC143C]" />
            <h2 className="text-white font-semibold">Profile Verification</h2>
          </div>
          <p className="text-white/50 text-sm mb-4 leading-relaxed">
            Get a verified badge on your profile. Upload a clear selfie — our team reviews it within 24 hours.
          </p>
          <div className={`flex items-center gap-2 mb-4 ${verifyBadge.color}`}>
            <verifyBadge.icon size={16} />
            <span className="text-sm font-medium">{verifyBadge.text}</span>
          </div>
          {(verifyStatus === 'NONE' || verifyStatus === 'REJECTED') && (
            <>
              <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleVerifyUpload} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 bg-[#DC143C] hover:bg-[#FF1744] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-70"
              >
                {uploading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera size={16} />}
                {uploading ? 'Uploading...' : 'Upload Selfie'}
              </button>
            </>
          )}
        </div>

        {/* Data Export */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Download size={20} className="text-blue-400" />
            <h2 className="text-white font-semibold">Your Data (POPIA)</h2>
          </div>
          <p className="text-white/50 text-sm mb-4 leading-relaxed">
            Download a copy of all data Velour holds about you, including your profile, photos, messages, and activity. Your right under South African POPIA law.
          </p>
          <a
            href="/api/account/export"
            download
            className="inline-flex items-center gap-2 glass border border-white/20 hover:border-white/40 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          >
            <Download size={16} />
            Download My Data
          </a>
        </div>

        {/* Delete Account */}
        <div className="glass rounded-2xl p-6 border border-red-500/20">
          <div className="flex items-center gap-3 mb-4">
            <Trash2 size={20} className="text-red-400" />
            <h2 className="text-white font-semibold">Delete Account</h2>
          </div>
          <p className="text-white/50 text-sm mb-4 leading-relaxed">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          {!deleteStep ? (
            <button
              onClick={() => setDeleteStep(true)}
              className="glass border border-red-500/40 text-red-400 hover:bg-red-500/10 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            >
              Delete My Account
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-red-400 text-sm font-medium">Type <strong>DELETE MY ACCOUNT</strong> to confirm:</p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                className="input-dark w-full px-4 py-2.5 rounded-xl text-sm border border-red-500/30"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleteConfirm !== 'DELETE MY ACCOUNT' || deleting}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                >
                  {deleting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 size={14} />}
                  Permanently Delete
                </button>
                <button onClick={() => { setDeleteStep(false); setDeleteConfirm(''); }} className="glass px-4 py-2.5 rounded-xl text-white/60 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
