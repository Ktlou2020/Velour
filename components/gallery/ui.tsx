'use client';

import { Lock, Star } from 'lucide-react';
import type { GalleryPhoto } from './types';

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-[#D4AF37]' : 'bg-white/15'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <span aria-hidden="true" className="inline-block border-2 border-white/80 border-t-transparent rounded-full animate-spin" style={{ width: size, height: size }} />;
}

export function Avatar({ url, name, size = 36 }: { url: string | null; name: string; size?: number }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="rounded-full object-cover bg-white/10 shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden="true" className="rounded-full bg-gradient-to-br from-[#DC143C]/40 to-[#D4AF37]/30 text-white/90 font-semibold flex items-center justify-center shrink-0" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Square photo tile for the owner's own photos (no watermark needed). */
export function PhotoTile({ photo, onClick, albumName, children, selected }: {
  photo: GalleryPhoto;
  onClick?: () => void;
  albumName?: string | null;
  children?: React.ReactNode;
  selected?: boolean;
}) {
  const label = `${photo.caption || 'Photo'}${photo.isProfile ? ', main photo' : ''}${photo.isPrivate ? ', private' : ''}${albumName ? `, in ${albumName}` : ''}`;
  return (
    <div className={`relative aspect-square rounded-xl overflow-hidden bg-white/5 group ${selected ? 'ring-2 ring-[#D4AF37] ring-offset-2 ring-offset-[#0A0A0F]' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.thumbnailUrl ?? photo.url} alt="" loading="lazy" decoding="async" draggable={false} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
      {onClick && (
        <button type="button" onClick={onClick} aria-label={label} className="absolute inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37] focus-visible:-outline-offset-2 rounded-xl" />
      )}
      <div className="absolute top-1.5 left-1.5 flex gap-1 pointer-events-none">
        {photo.isProfile && (
          <span className="flex items-center gap-1 bg-[#D4AF37] text-[#0A0A0F] text-[10px] font-bold px-1.5 py-0.5 rounded-full"><Star size={9} aria-hidden="true" /> Main</span>
        )}
        {photo.isPrivate && (
          <span className="flex items-center bg-black/70 text-white p-1 rounded-full" title="Private"><Lock size={10} aria-hidden="true" /></span>
        )}
      </div>
      {albumName && (
        <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate text-[10px] text-white/90 bg-black/60 px-1.5 py-0.5 rounded-md pointer-events-none w-fit max-w-[calc(100%-12px)]">{albumName}</span>
      )}
      {children}
    </div>
  );
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => <div key={i} className="aspect-square rounded-xl skeleton" />)}
    </div>
  );
}

export const btnPrimary = 'inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-[#DC143C]/20 disabled:opacity-60 disabled:cursor-not-allowed';
export const btnGhost = 'inline-flex items-center justify-center gap-2 glass border border-white/10 hover:border-white/25 text-white/80 hover:text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed';
export const btnDanger = 'inline-flex items-center justify-center gap-2 border border-red-500/30 hover:bg-red-500/10 text-red-300 hover:text-red-200 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-60';
