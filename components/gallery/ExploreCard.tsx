'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedImage from '@/components/ProtectedImage';
import { Compass, Heart, Trophy, ChevronRight } from 'lucide-react';
import { useToast } from '@/lib/toast-context';
import { api, type GalleryPhoto } from './types';
import { Switch } from './ui';

interface Settings {
  showInExplore: boolean;
  totalLikes: number;
  mostLiked: { id: string; thumbUrl: string; likeCount: number; isPrivate: boolean } | null;
}

/**
 * Top-of-gallery card: entry to Explore, "Show my public photos in Explore"
 * toggle (Profile.showInExplore) and my most-liked photo.
 */
export default function ExploreCard({ photos, onOpenPhoto }: { photos: GalleryPhoto[] | null; onOpenPhoto: (id: string) => void }) {
  const { showToast } = useToast();
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (window.location.hash === '#explore-settings') {
      document.getElementById('explore-settings')?.scrollIntoView({ block: 'start' });
    }
  }, []);

  useEffect(() => {
    api<Settings>('/api/gallery/settings').then(setS).catch(() => setS({ showInExplore: true, totalLikes: 0, mostLiked: null }));
  }, []);

  // Keep the highlight in step with the photos on the page (deletes, privacy changes).
  const fromPhotos = photos?.length
    ? [...photos].filter((p) => (p.likeCount ?? 0) > 0).sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))[0] ?? null
    : null;
  const total = photos ? photos.reduce((n, p) => n + (p.likeCount ?? 0), 0) : s?.totalLikes ?? 0;
  const best = photos ? fromPhotos : null;

  async function toggle(v: boolean) {
    if (!s) return;
    setSaving(true);
    setS({ ...s, showInExplore: v });
    try {
      await api('/api/gallery/settings', { method: 'PATCH', json: { showInExplore: v } });
      showToast(v ? 'Your public photos can appear in Explore' : 'Your photos are hidden from Explore', 'success');
    } catch (e) {
      setS({ ...s, showInExplore: !v });
      showToast(e instanceof Error ? e.message : 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="explore-settings" aria-labelledby="explore-card-title" className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#DC143C]/15 via-white/[0.03] to-[#D4AF37]/10 p-4 sm:p-5 mb-5 scroll-mt-24">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Link href="/gallery/explore" className="group flex items-center gap-3 min-w-0 flex-1">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#DC143C] shadow-lg shadow-[#DC143C]/30">
            <Compass size={22} className="text-white" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span id="explore-card-title" className="flex items-center gap-1 text-white font-semibold">
              Explore <ChevronRight size={16} className="text-white/50 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
            <span className="block text-white/60 text-xs sm:text-sm">See the community’s most-liked photos and like your favourites.</span>
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:border-l sm:border-white/10 sm:pl-4">
          {best ? (
            <button type="button" onClick={() => onOpenPhoto(best.id)} className="flex items-center gap-2.5 rounded-xl bg-black/25 hover:bg-black/40 p-1.5 pr-3 text-left" aria-label={`Your most liked photo, ${best.likeCount} likes`}>
              <ProtectedImage src={best.thumbnailUrl ?? best.url} alt="" className="h-11 w-11 rounded-lg shrink-0" />
              <span>
                <span className="flex items-center gap-1 text-[11px] text-[#D4AF37] font-semibold"><Trophy size={11} aria-hidden="true" /> Your most liked</span>
                <span className="flex items-center gap-1 text-white text-sm font-semibold tabular-nums"><Heart size={13} className="fill-[#DC143C] text-[#DC143C]" aria-hidden="true" />{best.likeCount}</span>
              </span>
            </button>
          ) : (
            <span className="text-white/55 text-xs flex items-center gap-1.5"><Heart size={13} aria-hidden="true" /> {total > 0 ? `${total} likes` : 'No likes yet'}</span>
          )}
        </div>
      </div>

      <label className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-black/25 px-3.5 py-3 cursor-pointer">
        <span className="min-w-0">
          <span className="block text-white text-sm font-medium">Show my public photos in Explore</span>
          <span className="block text-white/55 text-xs mt-0.5">
            {best || total > 0 ? `${total} like${total === 1 ? '' : 's'} so far · ` : ''}Private photos and private albums never appear.
          </span>
        </span>
        <Switch checked={s?.showInExplore ?? true} disabled={!s || saving} label="Show my public photos in Explore" onChange={toggle} />
      </label>
    </section>
  );
}
