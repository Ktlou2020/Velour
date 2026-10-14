'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, X } from 'lucide-react';
import ProtectedImage, { NO_SAVE_STYLE, useViewerMark } from '@/components/ProtectedImage';
import ProtectedVideo from '@/components/ProtectedVideo';
import { ViewOnceIcon } from '@/components/chat/ViewOnceBubble';

export interface ViewOnceOpen {
  mediaUrl: string;
  kind: 'photo' | 'video';
  durationSec: number | null;
  /** Photos: seconds on screen before the viewer closes itself */
  viewSec: number | null;
}

interface Props {
  open: ViewOnceOpen;
  onClose: () => void;
}

const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;

/**
 * Full-screen, one-time viewer for a view-once photo/video.
 *
 * The file is fetched once (uncached) into a Blob and shown from an object
 * URL that is revoked on close. Photos close themselves after `viewSec`
 * (countdown ring); videos play once — tap to pause/resume, no controls,
 * no seeking, no replay — and close at the end. Leaving the app (tab hidden)
 * also ends the view. Everything sits under `data-protected` so PrivacyShield
 * blurs it in the app switcher / on screenshot shortcuts; the image itself
 * carries the server-side per-viewer watermark.
 */
export default function ViewOnceViewer({ open, onClose }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [remaining, setRemaining] = useState<number>(open.viewSec ?? 10);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [mounted, setMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTime = useRef(0);
  const closedRef = useRef(false);
  const mark = useViewerMark(true);

  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    const v = videoRef.current;
    if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch { /* ignore */ } }
    onClose();
  }, [onClose]);

  useEffect(() => { setMounted(true); }, []);

  // Fetch the file once into memory
  useEffect(() => {
    const ctrl = new AbortController();
    let url: string | null = null;
    fetch(open.mediaUrl, { cache: 'no-store', credentials: 'same-origin', signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch((e) => { if (!ctrl.signal.aborted) { console.warn('view-once load failed', e instanceof Error ? e.message : e); setFailed(true); } });
    return () => {
      ctrl.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [open.mediaUrl]);

  // Photo countdown (starts once the image is on screen)
  useEffect(() => {
    if (open.kind !== 'photo' || !ready) return;
    const total = (open.viewSec ?? 10) * 1000;
    const started = Date.now();
    const t = setInterval(() => {
      const left = Math.max(0, total - (Date.now() - started));
      setRemaining(left / 1000);
      setProgress(1 - left / total);
      if (left <= 0) { clearInterval(t); close(); }
    }, 100);
    return () => clearInterval(t);
  }, [open.kind, open.viewSec, ready, close]);

  // Escape closes; save / print shortcuts are swallowed; leaving the app ends the view
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      const k = e.key?.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === 's' || k === 'p' || k === 'c')) e.preventDefault();
      if (open.kind === 'video' && (e.key === ' ' || e.key === 'k')) { e.preventDefault(); togglePlay(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') e.preventDefault();
    };
    const onVis = () => { if (document.visibilityState === 'hidden') close(); };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('visibilitychange', onVis);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('visibilitychange', onVis);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [close, open.kind]);

  function startVideo() {
    const v = videoRef.current;
    if (!v) return;
    v.play().then(() => { setNeedsTap(false); setPaused(false); }).catch(() => setNeedsTap(true));
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v || !ready) return;
    if (v.paused) startVideo();
    else { v.pause(); setPaused(true); }
  }

  const block = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); };

  if (!mounted) return null;

  return createPortal(
    <div
      data-protected=""
      role="dialog"
      aria-modal="true"
      aria-label={`View-once ${open.kind}`}
      className="fixed inset-0 z-[200] bg-black flex flex-col select-none"
      style={NO_SAVE_STYLE}
      onContextMenu={block}
      onDragStart={block}
    >
      {/* Top bar: progress / countdown + close */}
      <div className="absolute top-0 inset-x-0 z-20 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="h-0.5 w-full rounded-full bg-white/15 overflow-hidden" aria-hidden="true">
          <div className="h-full bg-white/80 transition-[width] duration-100 ease-linear" style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-white/85 text-sm font-medium">
            <ViewOnceIcon size={18} />
            {open.kind === 'video' ? 'Video' : 'Photo'} · View once
          </span>
          <div className="flex items-center gap-2">
            {open.kind === 'photo' && ready && (
              <span className="relative w-9 h-9 flex items-center justify-center" aria-label={`Closes in ${Math.ceil(remaining)} seconds`} role="timer">
                <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90 absolute inset-0" aria-hidden="true">
                  <circle cx="18" cy="18" r={RING_R} stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" fill="none" />
                  <circle cx="18" cy="18" r={RING_R} stroke="#DC143C" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray={RING_C} strokeDashoffset={RING_C * progress} />
                </svg>
                <span className="relative text-white text-xs font-semibold tabular-nums">{Math.ceil(remaining)}</span>
              </span>
            )}
            <button
              type="button"
              onClick={close}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]"
              aria-label="Close — you won’t be able to open this again"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Media */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        {failed ? (
          <div className="text-center px-8">
            <p className="text-white/80 text-sm">This view-once {open.kind} couldn’t be loaded.</p>
            <p className="text-white/45 text-xs mt-1">It may have expired. View-once media can’t be opened again.</p>
            <button type="button" onClick={close} className="mt-4 px-4 py-2 rounded-full bg-white/10 text-white text-sm hover:bg-white/20">Close</button>
          </div>
        ) : !blobUrl ? (
          <div className="w-7 h-7 border-2 border-[#DC143C] border-t-transparent rounded-full animate-spin" aria-label="Loading" />
        ) : open.kind === 'photo' ? (
          <ProtectedImage
            src={blobUrl}
            alt="View-once photo"
            loading="eager"
            watermark="hush"
            className="w-full h-full flex items-center justify-center"
            imgClassName="max-w-full max-h-full object-contain pointer-events-none"
            onLoad={() => setReady(true)}
          />
        ) : (
          <div className="relative w-full h-full" onClick={togglePlay}>
            <ProtectedVideo
              videoRef={videoRef}
              src={blobUrl}
              autoPlay
              preload="auto"
              watermark
              fullscreenButton={false}
              className="w-full h-full"
              videoClassName="w-full h-full object-contain bg-black"
              onLoadedData={() => { setReady(true); startVideo(); }}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                lastTime.current = v.currentTime;
                if (Number.isFinite(v.duration) && v.duration > 0) setProgress(v.currentTime / v.duration);
              }}
              onSeeking={(e) => {
                // No scrubbing: snap back to where playback was
                const v = e.currentTarget;
                if (Math.abs(v.currentTime - lastTime.current) > 0.75) v.currentTime = lastTime.current;
              }}
              onRateChange={(e) => { if (e.currentTarget.playbackRate !== 1) e.currentTarget.playbackRate = 1; }}
              onPause={() => setPaused(true)}
              onPlay={() => setPaused(false)}
              onEnded={close}
              onError={() => setFailed(true)}
              aria-label="View-once video"
            />
            {ready && (paused || needsTap) && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="w-16 h-16 rounded-full bg-black/55 backdrop-blur flex items-center justify-center ring-1 ring-white/30">
                  {needsTap || paused ? <Play size={26} className="text-white ml-1" fill="currentColor" /> : <Pause size={26} className="text-white" />}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Notice */}
      <div className="absolute bottom-0 inset-x-0 z-20 px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-6 bg-gradient-to-t from-black/85 to-transparent pointer-events-none">
        <p className="text-center text-[11px] leading-snug text-white/60">
          View once · {mark ? mark.replace(' · hush', '') : 'your'} watermark · Screenshots of members’ content aren’t allowed
        </p>
        {open.kind === 'video' && ready && (
          <p className="text-center text-[11px] text-white/40 mt-0.5">Tap to pause · plays once</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
