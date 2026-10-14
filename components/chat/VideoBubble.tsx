'use client';

import { useRef, useState } from 'react';
import { EyeOff, Play, Video } from 'lucide-react';
import { fmtDuration } from '@/lib/chat-games';

interface Props {
  src: string;
  durationSec?: number | null;
  sent: boolean;
  /** Recipient's "blur chat media" setting (Profile.showChatImages = false) */
  blurred: boolean;
  pending?: boolean;
  onLoaded?: () => void;
}

/**
 * Inline chat video: first frame as the poster (preload=metadata, with a
 * #t=0.1 fragment so iOS paints a frame), tap to play with native controls,
 * playsInline for iOS, never autoplays.
 */
export default function VideoBubble({ src, durationSec, sent, blurred, pending = false, onLoaded }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const hidden = blurred && !revealed;

  function play() {
    if (pending || failed) return;
    const v = ref.current;
    if (!v) return;
    setStarted(true);
    v.controls = true;
    window.dispatchEvent(new CustomEvent('hush:voice-play', { detail: src }));
    v.play().catch(() => setFailed(true));
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl ${sent ? 'rounded-tr-sm' : 'rounded-tl-sm'} bg-black/60 w-[240px] max-w-full ${pending ? 'opacity-60' : ''}`}>
      <video
        ref={ref}
        src={`${src}#t=0.1`}
        preload="metadata"
        playsInline
        muted={false}
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        onLoadedMetadata={onLoaded}
        onError={() => setFailed(true)}
        className={`block w-full max-h-80 object-cover bg-black transition-[filter] duration-300 ${hidden ? 'blur-2xl scale-110' : ''}`}
        aria-label="Video message"
      />
      {/* Light watermark, like protected photos */}
      {!hidden && !started && (
        <span className="pointer-events-none absolute bottom-2 left-2.5 text-[10px] font-semibold tracking-[0.25em] text-white/35 select-none" aria-hidden="true">HUSH</span>
      )}
      {hidden ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/30 text-white text-sm font-medium"
        >
          <EyeOff size={20} className="text-white/80" />
          Tap to view
        </button>
      ) : !started && (
        <button
          type="button"
          onClick={play}
          disabled={pending}
          className="absolute inset-0 flex items-center justify-center bg-black/15 hover:bg-black/25 transition-colors"
          aria-label="Play video"
        >
          <span className="w-12 h-12 rounded-full bg-black/55 backdrop-blur flex items-center justify-center ring-1 ring-white/30">
            <Play size={20} className="text-white ml-0.5" fill="currentColor" />
          </span>
        </button>
      )}
      {!started && (
        <span className="pointer-events-none absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[11px] text-white tabular-nums">
          <Video size={11} aria-hidden="true" />
          {failed ? 'Can’t play here' : durationSec != null ? fmtDuration(durationSec) : 'Video'}
        </span>
      )}
    </div>
  );
}
