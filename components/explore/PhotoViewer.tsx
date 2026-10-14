'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X, ChevronLeft, ChevronRight, Heart, MessageCircle, BadgeCheck, Flag, Plane, UserRound, Users } from 'lucide-react';
import ProtectedImage from '@/components/ProtectedImage';
import { Avatar, Spinner } from '@/components/gallery/ui';
import { useToast } from '@/lib/toast-context';
import HeartBurst from './HeartBurst';
import { useDoubleTap } from './useDoubleTap';
import { compactCount, posterLine, type ExplorePhoto } from './types';

interface Props {
  photos: ExplorePhoto[];
  index: number;
  watermark: string;
  hasMore: boolean;
  onIndex: (i: number) => void;
  onClose: () => void;
  onLike: (photo: ExplorePhoto, desired: boolean) => void;
  onNearEnd: () => void;
  onReport: (photo: ExplorePhoto) => void;
  onShowLikers: (photo: ExplorePhoto) => void;
}

const ratios = new Map<string, number>();

function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PhotoViewer({ photos, index, watermark, hasMore, onIndex, onClose, onLike, onNearEnd, onReport, onShowLikers }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const photo = photos[index];
  const stageRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [ratio, setRatio] = useState<number>(() => (photo && ratios.get(photo.id)) || 0.8);
  const [loaded, setLoaded] = useState(false);
  const [burst, setBurst] = useState(0);
  const [replying, setReplying] = useState(false);
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);

  const prev = useCallback(() => { if (index > 0) onIndex(index - 1); }, [index, onIndex]);
  const next = useCallback(() => { if (index < photos.length - 1) onIndex(index + 1); }, [index, photos.length, onIndex]);

  // Focus, scroll lock, focus return.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.body.style.overflow = overflow; before?.focus?.(); };
  }, []);

  // Keyboard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not([data-explore-viewer])')) return; // a dialog above us
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if ((e.key === 'l' || e.key === 'L') && photo && !photo.isOwn && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) onLike(photo, !photo.liked);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next, photo, onLike]);

  // Stage size → fit the photo exactly (ProtectedImage covers its box).
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setStage({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Natural aspect ratio of the full image; preload neighbours.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const photoId = photo?.id;
  const photoUrl = photo?.url;
  useEffect(() => {
    if (!photoId || !photoUrl) return;
    let alive = true;
    setLoaded(false);
    setBurst(0);
    const known = ratios.get(photoId);
    if (known) setRatio(known);
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      const r = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0.8;
      ratios.set(photoId, r);
      setRatio(r);
      setLoaded(true);
    };
    img.onerror = () => { if (alive) setLoaded(true); };
    img.src = photoUrl;
    const list = photosRef.current;
    const i = list.findIndex((x) => x.id === photoId);
    for (const n of [list[i + 1], list[i - 1]]) if (n) { const pre = new Image(); pre.src = n.url; }
    return () => { alive = false; };
  }, [photoId, photoUrl]);

  useEffect(() => {
    if (hasMore && index >= photos.length - 4) onNearEnd();
  }, [index, photos.length, hasMore, onNearEnd]);

  const tap = useDoubleTap(
    () => {},
    () => {
      if (!photo || photo.isOwn) return;
      setBurst((n) => n + 1);
      if (!photo.liked) onLike(photo, true);
    },
  );

  if (!photo) return null;
  const p = photo.poster;

  const fitW = stage.w && stage.h ? Math.min(stage.w, stage.h * ratio) : 0;
  const fitH = fitW ? fitW / ratio : 0;

  async function reply() {
    if (!photo) return;
    setReplying(true);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUsername: p.username }),
      });
      const d = await res.json().catch(() => ({}));
      const convId = d?.conversation?.id;
      if (!res.ok || !convId) throw new Error(d.error || 'Could not start a chat');
      const draft = `Loved your photo 📸${photo.caption ? ` “${photo.caption.slice(0, 60)}${photo.caption.length > 60 ? '…' : ''}”` : ''} `;
      router.push(`/messages?conv=${encodeURIComponent(convId)}&draft=${encodeURIComponent(draft)}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not start a chat', 'error');
      setReplying(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo by ${photo.isOwn ? 'you' : p.name}`}
      data-explore-viewer=""
      className="fixed inset-0 z-[60] flex flex-col bg-[#05050A]/[0.97] backdrop-blur-sm"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-3 sm:px-5 h-14 shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="p-2.5 -ml-1 rounded-full text-white/80 hover:text-white hover:bg-white/10">
          <X size={22} />
        </button>
        <p className="text-white/50 text-xs tabular-nums" aria-live="polite">
          {index + 1} / {photos.length}{hasMore ? '+' : ''}
        </p>
        {!photo.isOwn ? (
          <button type="button" onClick={() => onReport(photo)} aria-label="Report photo" className="p-2.5 -mr-1 rounded-full text-white/60 hover:text-white hover:bg-white/10">
            <Flag size={18} />
          </button>
        ) : <span className="w-10" />}
      </div>

      {/* Stage */}
      <div className="relative flex-1 min-h-0 px-2 sm:px-16">
        <div ref={stageRef} className="relative h-full w-full flex items-center justify-center">
          {fitW > 0 && (
            <div className="relative rounded-xl overflow-hidden bg-white/5" style={{ width: fitW, height: fitH }}>
              {/* Thumbnail underneath while the full photo loads */}
              {!loaded && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.thumbUrl} alt="" aria-hidden="true" draggable={false} data-protected="" className="absolute inset-0 w-full h-full object-cover blur-md scale-105 opacity-60 pointer-events-none select-none" />
              )}
              <ProtectedImage
                key={photo.id}
                src={photo.url}
                alt={photo.caption || `Photo by ${p.name}`}
                watermark={watermark}
                loading="eager"
                className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
              />
              {!loaded && <span className="absolute inset-0 flex items-center justify-center"><Spinner size={22} /></span>}
              <div
                className="absolute inset-0 z-10"
                onClick={tap}
                onContextMenu={(e) => e.preventDefault()}
                onTouchStart={(e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY, t: Date.now() }; }}
                onTouchEnd={(e) => {
                  const s = touch.current; touch.current = null;
                  if (!s) return;
                  const t = e.changedTouches[0];
                  const dx = t.clientX - s.x, dy = t.clientY - s.y;
                  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3 && Date.now() - s.t < 800) {
                    if (dx < 0) next(); else prev();
                  } else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) {
                    onClose();
                  }
                }}
                style={{ touchAction: 'pan-y pinch-zoom', WebkitTouchCallout: 'none' } as React.CSSProperties}
                aria-hidden="true"
              />
              {burst > 0 && <HeartBurst key={burst} size={120} />}
            </div>
          )}
        </div>
        {index > 0 && (
          <button type="button" onClick={prev} aria-label="Previous photo" className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 h-11 w-11 items-center justify-center rounded-full glass text-white/80 hover:text-white">
            <ChevronLeft size={22} />
          </button>
        )}
        {index < photos.length - 1 && (
          <button type="button" onClick={next} aria-label="Next photo" className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 items-center justify-center rounded-full glass text-white/80 hover:text-white">
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {/* Details */}
      <div className="shrink-0 px-4 pt-3 pb-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3">
            <Link href={`/members/${encodeURIComponent(p.username)}`} className="flex items-center gap-3 min-w-0 flex-1 rounded-xl -m-1 p-1 hover:bg-white/5">
              <Avatar url={p.avatarUrl} name={p.name} size={44} />
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-white font-semibold">
                  <span className="truncate">{photo.isOwn ? `${p.name} (you)` : p.name}</span>
                  {p.isVerified && <BadgeCheck size={15} className="text-sky-400 shrink-0" aria-label="Verified" />}
                  {p.isCouple && <Users size={13} className="text-white/45 shrink-0" aria-label="Couple" />}
                </span>
                <span className="flex items-center gap-1 text-white/55 text-xs truncate">
                  {p.travelling && <Plane size={11} className="shrink-0" aria-label="Visiting" />}
                  <span className="truncate">{[posterLine(photo), p.coupleBadge, timeAgo(photo.createdAt)].filter(Boolean).join(' · ')}</span>
                </span>
              </span>
            </Link>
            {photo.isOwn ? (
              <button type="button" onClick={() => onShowLikers(photo)} className="flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 h-11 text-sm text-white/85 hover:text-white hover:border-white/30">
                <Heart size={16} className="fill-[#DC143C] text-[#DC143C]" aria-hidden="true" />
                <span className="tabular-nums font-semibold">{compactCount(photo.likeCount)}</span>
                <span className="hidden sm:inline">· See who</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onLike(photo, !photo.liked)}
                aria-pressed={photo.liked}
                aria-label={photo.liked ? 'Unlike photo' : 'Like photo'}
                className={`flex items-center gap-1.5 rounded-full px-4 h-11 text-sm font-semibold transition-colors ${photo.liked ? 'bg-[#DC143C] text-white shadow-lg shadow-[#DC143C]/30' : 'border border-white/20 text-white hover:border-white/40'}`}
              >
                <Heart size={17} className={photo.liked ? 'fill-white' : ''} aria-hidden="true" />
                <span className="tabular-nums">{compactCount(photo.likeCount)}</span>
              </button>
            )}
          </div>

          {photo.caption && <p className="text-white/85 text-sm mt-3 leading-relaxed break-words line-clamp-3">{photo.caption}</p>}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={`/members/${encodeURIComponent(p.username)}`} className="flex items-center justify-center gap-2 rounded-xl glass border border-white/10 hover:border-white/25 h-11 text-sm text-white/85 hover:text-white">
              <UserRound size={16} aria-hidden="true" /> View profile
            </Link>
            {photo.isOwn ? (
              <Link href="/gallery" className="flex items-center justify-center gap-2 rounded-xl glass border border-white/10 hover:border-white/25 h-11 text-sm text-white/85 hover:text-white">
                Manage my photos
              </Link>
            ) : (
              <button type="button" onClick={reply} disabled={replying} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] h-11 text-sm font-semibold text-white disabled:opacity-60">
                {replying ? <Spinner /> : <MessageCircle size={16} aria-hidden="true" />} Reply privately
              </button>
            )}
          </div>
          <p className="hidden sm:block text-center text-white/30 text-[11px] mt-3">← → to browse · double-click or L to like · Esc to close</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
