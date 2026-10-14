'use client';

import { Trophy, Heart } from 'lucide-react';
import ProtectedImage from '@/components/ProtectedImage';
import { compactCount, type ExplorePhoto } from './types';

interface Props {
  photos: ExplorePhoto[] | null;
  period: 'week' | 'rolling';
  watermark: string;
  onOpen: (photo: ExplorePhoto) => void;
}

/** "Top photos this week": horizontal, snap-scrolling, with big rank numerals. */
export default function TopStrip({ photos, period, watermark, onOpen }: Props) {
  if (photos && photos.length === 0) return null;
  return (
    <section aria-labelledby="top-strip-title" className="mb-6">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 id="top-strip-title" className="flex items-center gap-2 text-white font-semibold">
            <Trophy size={16} className="text-[#D4AF37]" aria-hidden="true" />
            {period === 'week' ? 'Top photos this week' : 'Top photos (last 7 days)'}
          </h2>
          <p className="text-white/45 text-xs mt-0.5">{period === 'week' ? 'Most liked since Monday' : 'Most liked over the past week'}</p>
        </div>
      </div>
      <ol className="hush-no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1" aria-label="Top photos">
        {photos === null
          ? Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="shrink-0 w-[132px] sm:w-[150px]"><div className="aspect-[4/5] rounded-2xl skeleton" /></li>
          ))
          : photos.map((p, i) => (
            <li key={p.id} className="shrink-0 snap-start w-[132px] sm:w-[150px]">
              <button
                type="button"
                onClick={() => onOpen(p)}
                aria-label={`Number ${i + 1}: photo by ${p.isOwn ? 'you' : p.poster.name}, ${p.weekLikes ?? p.likeCount} likes`}
                className="group relative block w-full text-left rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]"
              >
                <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-[#D4AF37]/50 transition-colors">
                  <ProtectedImage src={p.thumbUrl} alt="" watermark={watermark} loading={i < 4 ? 'eager' : 'lazy'} className="absolute inset-0 w-full h-full" />
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                  {/* covers the protected image so touch scrolling works */}
                  <span aria-hidden="true" className="absolute inset-0" style={{ touchAction: 'pan-x pan-y' }} />
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute left-1.5 bottom-6 font-serif font-black leading-none text-[56px] ${i === 0 ? 'text-[#D4AF37]' : 'text-white/90'}`}
                    style={{ WebkitTextStroke: '1px rgba(0,0,0,.35)', textShadow: '0 4px 18px rgba(0,0,0,.6)' }}
                  >
                    {i + 1}
                  </span>
                  <span className="pointer-events-none absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    <Heart size={11} className="fill-[#DC143C] text-[#DC143C]" aria-hidden="true" />
                    {compactCount(p.weekLikes ?? p.likeCount)}
                  </span>
                  <span className="pointer-events-none absolute left-2 right-12 bottom-2 truncate text-[11px] font-medium text-white/85">
                    {p.isOwn ? 'You' : p.poster.name}
                  </span>
                </div>
              </button>
            </li>
          ))}
      </ol>
    </section>
  );
}
