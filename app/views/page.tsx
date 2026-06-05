'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Eye, Crown, Lock } from 'lucide-react';
import Link from 'next/link';

interface ViewerNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  data: {
    viewerId?: string;
    viewerUsername?: string;
  } | null;
}

interface ViewerProfile {
  notificationId: string;
  viewerId: string;
  viewerUsername: string;
  viewedAt: string;
  profilePhoto?: string;
  displayName?: string;
  city?: string;
  membershipTier?: string;
}

export default function ViewsPage() {
  const [viewers, setViewers] = useState<ViewerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<string>('FREE');
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        // Get current user's tier
        const profileRes = await fetch('/api/profile');
        if (profileRes.ok) {
          const profileData = await profileRes.json() as { user?: { profile?: { membershipTier?: string } } };
          const userTier = profileData.user?.profile?.membershipTier ?? 'FREE';
          setTier(userTier);

          if (userTier === 'FREE') {
            setLoading(false);
            return;
          }
        }

        // Get PROFILE_VIEW notifications
        const res = await fetch('/api/notifications');
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json() as { notifications: ViewerNotification[] };

        const viewNotifications = (data.notifications || []).filter(
          (n) => n.type === 'PROFILE_VIEW'
        );

        // Deduplicate by viewerId, keep most recent
        const seen = new Map<string, ViewerProfile>();
        for (const n of viewNotifications) {
          const viewerId = n.data?.viewerId;
          const viewerUsername = n.data?.viewerUsername;
          if (!viewerId || !viewerUsername) continue;
          if (!seen.has(viewerId)) {
            seen.set(viewerId, {
              notificationId: n.id,
              viewerId,
              viewerUsername,
              viewedAt: n.createdAt,
            });
          }
        }

        // Enrich with profile data
        const enriched: ViewerProfile[] = [];
        for (const [, viewer] of seen) {
          try {
            const pRes = await fetch(`/api/profile/${viewer.viewerUsername}`);
            if (pRes.ok) {
              const pData = await pRes.json() as {
                user?: {
                  profile?: {
                    displayName?: string;
                    profilePhoto?: string;
                    city?: string;
                    membershipTier?: string;
                  };
                };
              };
              enriched.push({
                ...viewer,
                displayName: pData.user?.profile?.displayName ?? undefined,
                profilePhoto: pData.user?.profile?.profilePhoto ?? undefined,
                city: pData.user?.profile?.city ?? undefined,
                membershipTier: pData.user?.profile?.membershipTier ?? undefined,
              });
            } else {
              enriched.push(viewer);
            }
          } catch {
            enriched.push(viewer);
          }
        }

        setViewers(enriched.sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime()));
      } catch {
        setError('Failed to load profile views');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function formatTimeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        <div className="bg-gradient-to-b from-[#0F0A1E] to-[#0A0A0F] py-12 px-4 border-b border-white/5">
          <div className="max-w-4xl mx-auto">
            <h1 className="font-serif text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <Eye className="text-[#DC143C]" size={32} />
              Who Viewed Me
            </h1>
            <p className="text-white/50">See who has been checking out your profile</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-[#DC143C] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tier === 'FREE' ? (
            <div className="glass rounded-3xl p-12 text-center max-w-md mx-auto">
              <div className="w-20 h-20 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock className="text-[#D4AF37]" size={32} />
              </div>
              <h2 className="font-serif text-2xl font-bold text-white mb-3">Gold Feature</h2>
              <p className="text-white/50 mb-6 leading-relaxed">
                Upgrade to Gold or Platinum to see exactly who has been viewing your profile.
              </p>
              <div className="flex items-center justify-center gap-1 text-[#D4AF37] mb-6">
                <Crown size={16} />
                <span className="text-sm font-semibold">Available on GOLD &amp; PLATINUM</span>
              </div>
              <Link
                href="/upgrade"
                className="inline-block bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] font-bold px-8 py-3 rounded-xl hover:from-[#F4D03F] hover:to-[#D4AF37] transition-all"
              >
                Upgrade Now
              </Link>
            </div>
          ) : error ? (
            <p className="text-red-400 text-center py-12">{error}</p>
          ) : viewers.length === 0 ? (
            <div className="text-center py-20">
              <Eye className="text-white/10 mx-auto mb-4" size={48} />
              <p className="text-white/40 text-lg">No profile views yet</p>
              <p className="text-white/20 text-sm mt-2">When someone views your profile, they&apos;ll appear here</p>
            </div>
          ) : (
            <>
              <p className="text-white/40 text-sm mb-6">{viewers.length} people viewed your profile</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {viewers.map((v) => (
                  <Link
                    key={v.viewerId}
                    href={`/members/${v.viewerUsername}`}
                    className="glass rounded-2xl p-4 hover:bg-white/5 transition-colors group"
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center mx-auto mb-3 overflow-hidden">
                      {v.profilePhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.profilePhoto} alt={v.viewerUsername} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-xl">
                          {(v.displayName || v.viewerUsername).slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-white text-sm font-medium text-center truncate group-hover:text-[#DC143C] transition-colors">
                      {v.displayName || v.viewerUsername}
                    </p>
                    {v.city && (
                      <p className="text-white/40 text-xs text-center truncate mt-0.5">{v.city}</p>
                    )}
                    <p className="text-white/20 text-xs text-center mt-1">{formatTimeAgo(v.viewedAt)}</p>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
