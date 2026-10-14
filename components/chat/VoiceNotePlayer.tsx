'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { fmtDuration } from '@/lib/chat-games';

const SPEEDS = [1, 1.5, 2] as const;
const PLAY_EVENT = 'hush:voice-play';
const BARS = 32;

/** Resample stored bar heights (0–100) to a fixed bar count; flat-ish fallback. */
function bars(waveform: number[] | null | undefined, seed: string): number[] {
  if (waveform && waveform.length >= 4) {
    return Array.from({ length: BARS }, (_, i) => {
      const v = waveform[Math.floor((i / BARS) * waveform.length)] ?? 0;
      return Math.max(12, Math.min(100, v));
    });
  }
  // Deterministic pseudo-waveform from the URL so old notes don't look empty
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: BARS }, () => {
    h = (h * 1103515245 + 12345) >>> 0;
    return 25 + (h % 60);
  });
}

interface Props {
  src: string;
  /** Duration from the message (MediaRecorder WebM files often report Infinity) */
  durationSec?: number | null;
  waveform?: number[] | null;
  sent?: boolean;
  pending?: boolean;
}

export default function VoiceNotePlayer({ src, durationSec, waveform, sent = false, pending = false }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const total = Math.max(1, durationSec ?? 1);
  const heights = useRef(bars(waveform, src)).current;
  const progress = Math.min(1, current / total);

  // Only one voice note plays at a time
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== src) audioRef.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, onOther);
    return () => window.removeEventListener(PLAY_EVENT, onOther);
  }, [src]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  function audio(): HTMLAudioElement {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'metadata';
      a.src = src;
      a.addEventListener('timeupdate', () => setCurrent(a.currentTime));
      a.addEventListener('playing', () => { setPlaying(true); setLoading(false); });
      a.addEventListener('pause', () => setPlaying(false));
      a.addEventListener('waiting', () => setLoading(true));
      a.addEventListener('ended', () => { setPlaying(false); setCurrent(0); });
      a.addEventListener('error', () => { setFailed(true); setPlaying(false); setLoading(false); });
      audioRef.current = a;
    }
    return audioRef.current;
  }

  function toggle() {
    if (pending || failed) return;
    const a = audio();
    if (a.paused) {
      window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: src }));
      a.playbackRate = SPEEDS[speedIdx];
      setLoading(true);
      // play() must run inside the tap handler for iOS Safari
      a.play().catch(() => { setLoading(false); setFailed(true); });
    } else {
      a.pause();
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) {
    if (pending || failed) return;
    const a = audio();
    let frac: number;
    if ('key' in e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      frac = Math.max(0, Math.min(1, progress + (e.key === 'ArrowRight' ? 0.1 : -0.1)));
    } else {
      const r = e.currentTarget.getBoundingClientRect();
      frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    }
    const dur = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : total;
    try { a.currentTime = frac * dur; } catch { /* not seekable yet */ }
    setCurrent(frac * dur);
  }

  function cycleSpeed() {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  }

  const shown = playing || current > 0 ? current : total;

  return (
    <div
      className={`flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-2xl w-[236px] max-w-full ${sent ? 'bg-[#DC143C] rounded-tr-sm' : 'glass rounded-tl-sm'} ${pending ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={pending || failed}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${sent ? 'bg-white/20 hover:bg-white/30' : 'bg-[#DC143C]/90 hover:bg-[#DC143C]'} disabled:opacity-50`}
      >
        {loading && !playing
          ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : playing
            ? <Pause size={16} className="text-white" fill="currentColor" />
            : <Play size={16} className="text-white ml-0.5" fill="currentColor" />}
      </button>
      <div className="flex-1 min-w-0">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(current)}
          onClick={seek}
          onKeyDown={seek}
          className="flex items-center gap-[2px] h-7 cursor-pointer"
        >
          {heights.map((h, i) => {
            const on = (i + 0.5) / heights.length <= progress;
            return (
              <span
                key={i}
                className={`flex-1 rounded-full transition-colors ${on ? (sent ? 'bg-white' : 'bg-[#D4AF37]') : (sent ? 'bg-white/40' : 'bg-white/25')}`}
                style={{ height: `${h}%` }}
              />
            );
          })}
        </div>
        <div className={`flex items-center justify-between text-[11px] mt-0.5 ${sent ? 'text-white/80' : 'text-white/60'}`}>
          <span className="flex items-center gap-1 tabular-nums min-w-0 truncate" title={failed ? 'This browser can’t play this voice note' : undefined}>
            <Mic size={10} className="flex-shrink-0" aria-hidden="true" />
            {failed ? 'Can’t play here' : fmtDuration(shown)}
          </span>
          <button
            type="button"
            onClick={cycleSpeed}
            className={`px-1.5 rounded-full font-semibold tabular-nums ${sent ? 'bg-white/20' : 'bg-white/10'} hover:bg-white/30`}
            aria-label={`Playback speed ${SPEEDS[speedIdx]}x`}
          >
            {SPEEDS[speedIdx]}×
          </button>
        </div>
      </div>
    </div>
  );
}
