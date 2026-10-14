'use client';

import { memo, useState } from 'react';
import { Heart, BadgeCheck, Plane } from 'lucide-react';
import ProtectedImage from '@/components/ProtectedImage';
import { Avatar } from '@/components/gallery/ui';
import HeartBurst from './HeartBurst';
import { useDoubleTap } from './useDoubleTap';
import { tileRatio } from './useColumns';
import { compactCount, posterLine, type ExplorePhoto } from './types';

interface Props {
  photo: ExplorePhoto;
  watermark: string;
  showRank?: boolean;
  eager?: boolean;
  onOpen: (photo: ExplorePhoto) => void;
  /** desired = true to like, false to unlike. */
  onLike: (photo: ExplorePhoto, desired: boolean) => void;
  onShowLikers: (photo: ExplorePhoto) => void;
}

function ExploreTile({ photo, watermark, showRank, eager, onOpen, onLike, onShowLikers }: Props) {
  const [burst, setBurst] = useState(0);
  const [pop, setPop] = useState(0);
  const p = photo.poster;

  const tap = useDoubleTap(
    () => onOpen(photo),
    () => {
      if (photo.isOwn) return;
      setBurst((n) => n + 1);
      if (!photo.liked) onLike(photo, true);
    },
  );

  const ratio = tileRatio(photo.id);
  const label = `Photo by ${photo.isOwn ? 'you' : p.name}${photo.caption ? `: ${photo.caption}` : ''}. ${photo.likeCount} like${photo.likeCount === 1 ? '' : 's'}. Double-tap to like.`;

  return (
    <article className="group relative rounded-2xl overflow-hidden bg-white/[0.04] border border-white/[0.07] hover:border-white/15 transition-colors">
      <div className="relative" style={{ aspectRatio: `1 / ${ratio}` }}>
        <ProtectedImage
          src={photo.thumbUrl}
          alt=""
          watermark={watermark}
          loading={eager ? 'eager' : 'lazy'}
          className="absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/50 to-transparent" />
        {/* Tap layer: sits above the protected image so the page still scrolls on touch. */}
        <button
          type="button"
          onClick={tap}
          onContextMenu={(e) => e.preventDefault()}
          aria-label={label}
          className="absolute inset-0 z-10 w-full h-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37] focus-visible:-outline-offset-2"
          style={{ touchAction: 'manipulation', WebkitTouchCallout: 'none' } as React.CSSProperties}
        />
        <div className="pointer-events-none absolute top-2 left-2 right-2 z-10 flex flex-wrap gap-1">
          {showRank && photo.rank !== null && photo.rank <= 10 && !photo.trending && (
            <span className="rounded-full bg-black/60 backdrop-blur px-2 py-0.5 text-[10px] font-bold text-[#D4AF37]">#{photo.rank}</span>
          )}
          {photo.trending && (
            <span className="rounded-full bg-gradient-to-r from-[#DC143C] to-[#FF6B35] px-2 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-[#DC143C]/30">
              <span aria-hidden="true">🔥 </span>Trending
            </span>
          )}
          {photo.isNew && (
            <span className="rounded-full bg-[#D4AF37] px-2 py-0.5 text-[10px] font-bold text-[#0A0A0F]">New</span>
          )}
        </div>
        {burst > 0 && <HeartBurst key={burst} size={72} />}
      </div>

      <div className="flex items-center gap-2 px-2.5 py-2">
        <Avatar url={p.avatarUrl} name={p.name} size={28} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-white text-[13px] font-semibold leading-tight">
            <span className="truncate">{photo.isOwn ? 'You' : p.name}</span>
            {p.isVerified && <BadgeCheck size={13} className="shrink-0 text-sky-400" aria-label="Verified" />}
          </p>
          <p className="flex items-center gap-1 text-white/55 text-[11px] leading-tight mt-0.5 truncate">
            {p.travelling && <Plane size={10} className="shrink-0" aria-label="Visiting" />}
            <span className="truncate">{photo.isOwn ? p.name : posterLine(photo) || ' '}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (photo.isOwn) { onShowLikers(photo); return; }
            setPop((n) => n + 1);
            onLike(photo, !photo.liked);
          }}
          aria-pressed={photo.isOwn ? undefined : photo.liked}
          aria-label={photo.isOwn ? `See who liked your photo (${photo.likeCount})` : photo.liked ? `Unlike (${photo.likeCount} likes)` : `Like (${photo.likeCount} likes)`}
          className="relative z-10 -mr-1 flex min-w-[44px] h-11 items-center justify-center gap-1 rounded-full px-2 text-white/80 hover:text-white hover:bg-white/5 transition-colors"
        >
          <span key={pop} className={pop ? 'hush-pop inline-flex' : 'inline-flex'}>
            <Heart size={18} aria-hidden="true" className={photo.liked ? 'fill-[#DC143C] text-[#DC143C]' : ''} />
          </span>
          <span className="text-xs font-semibold tabular-nums">{compactCount(photo.likeCount)}</span>
        </button>
      </div>
    </article>
  );
}

export default memo(ExploreTile);
