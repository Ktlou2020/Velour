'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { NO_SAVE_STYLE, useViewerMark, watermarkBackground } from '@/components/ProtectedImage';

interface Props extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, 'controlsList' | 'disablePictureInPicture' | 'disableRemotePlayback' | 'playsInline'> {
  src: string;
  /** Classes for the wrapper (size/rounding). The <video> gets `videoClassName`. */
  className?: string;
  videoClassName?: string;
  /** Show the viewer watermark over the video (default on). Pass false for your own videos. */
  watermark?: boolean;
  videoRef?: React.Ref<HTMLVideoElement>;
  /** Show our own fullscreen button (keeps the watermark visible); default true. */
  fullscreenButton?: boolean;
  children?: React.ReactNode;
}

/**
 * A member's video with save protections:
 * - no download / playback-rate / cast entries, no picture-in-picture, no
 *   remote playback, no context menu, always inline on iOS
 * - the viewer's @username tiled faintly over the picture (a DOM layer, so
 *   it is in any screen recording); the file itself carries the owner's mark
 * - fullscreen goes through the wrapper, never the bare <video>, so the
 *   watermark stays on top (the native fullscreen control is hidden)
 * - `data-protected` for PrivacyShield (app switcher / screenshot keys / print)
 */
export default function ProtectedVideo({
  src, className, videoClassName, watermark = true, videoRef, fullscreenButton = true, children, ...video
}: Props) {
  const mark = useViewerMark(watermark);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setCanFullscreen(!!document.fullscreenEnabled && typeof wrapRef.current?.requestFullscreen === 'function');
    const onChange = () => setIsFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function toggleFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen().catch(() => {});
  }

  const block = (e: React.SyntheticEvent) => { e.preventDefault(); };

  return (
    <div
      ref={wrapRef}
      data-protected=""
      className={`relative overflow-hidden select-none [&:fullscreen]:bg-black [&:fullscreen]:flex [&:fullscreen]:items-center [&:fullscreen]:justify-center [&:fullscreen_video]:h-full [&:fullscreen_video]:w-full [&:fullscreen_video]:max-h-none [&:fullscreen_video]:object-contain ${className ?? ''}`}
      style={NO_SAVE_STYLE}
      onContextMenu={block}
      onDragStart={block}
    >
      <video
        ref={videoRef}
        src={src}
        {...video}
        playsInline
        controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
        disablePictureInPicture
        disableRemotePlayback
        onContextMenu={block}
        draggable={false}
        className={videoClassName}
        style={{ ...NO_SAVE_STYLE, ...video.style }}
      />
      {mark && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true" style={watermarkBackground(mark, 0.12)} />
      )}
      {children}
      {fullscreenButton && canFullscreen && (
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
          className="absolute top-2 left-2 z-10 p-1.5 rounded-full bg-black/55 text-white/85 hover:text-white backdrop-blur"
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      )}
    </div>
  );
}
