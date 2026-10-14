'use client';

import { Trash2, Square, Send, ChevronLeft } from 'lucide-react';
import VoiceNotePlayer from '@/components/chat/VoiceNotePlayer';
import { fmtDuration } from '@/lib/chat-games';
import { MAX_VOICE_SEC, type VoiceRecorder } from '@/components/chat/useVoiceRecorder';

interface Props {
  rec: VoiceRecorder;
  /** Finger is down on the mic (hold-to-record): show the slide-to-cancel hint */
  holding: boolean;
  sending: boolean;
  onSend: () => void;
}

/** Replaces the composer row while recording / previewing a voice note. */
export default function VoiceRecorderBar({ rec, holding, sending, onSend }: Props) {
  const sec = rec.elapsedMs / 1000;
  const nearEnd = sec >= MAX_VOICE_SEC - 10;

  if (rec.state === 'preview' && rec.clip) {
    return (
      <div className="flex items-center gap-2" aria-label="Voice note preview">
        <button
          type="button"
          onClick={rec.discard}
          disabled={sending}
          className="w-10 h-10 rounded-xl glass flex items-center justify-center text-white/65 hover:text-red-400 flex-shrink-0"
          aria-label="Delete voice note"
        >
          <Trash2 size={18} />
        </button>
        <div className="flex-1 min-w-0 flex">
          <VoiceNotePlayer src={rec.clip.url} durationSec={rec.clip.durationSec} waveform={rec.clip.waveform} />
        </div>
        <button
          type="button"
          onClick={onSend}
          disabled={sending}
          className="w-10 h-10 rounded-xl bg-[#DC143C] hover:bg-[#FF1744] flex items-center justify-center flex-shrink-0 disabled:opacity-60"
          aria-label="Send voice note"
        >
          {sending
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Send size={16} className="text-white" />}
        </button>
      </div>
    );
  }

  const bars = Array.from({ length: 40 }, (_, i) => rec.levels[rec.levels.length - 40 + i] ?? 0);
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <button
        type="button"
        onClick={rec.cancel}
        className="w-10 h-10 rounded-xl glass flex items-center justify-center text-white/65 hover:text-red-400 flex-shrink-0"
        aria-label="Cancel recording"
      >
        <Trash2 size={18} />
      </button>
      <div className="flex-1 min-w-0 h-11 rounded-xl input-dark flex items-center gap-2.5 px-3">
        <span className="w-2.5 h-2.5 rounded-full bg-[#DC143C] animate-pulse flex-shrink-0" aria-hidden="true" />
        <span className={`text-sm tabular-nums flex-shrink-0 ${nearEnd ? 'text-[#D4AF37]' : 'text-white'}`}>
          {rec.state === 'starting' ? 'Starting…' : `${fmtDuration(sec)} / ${fmtDuration(MAX_VOICE_SEC)}`}
        </span>
        {holding ? (
          <span className="flex-1 min-w-0 flex items-center justify-center gap-1 text-xs text-white/55 truncate">
            <ChevronLeft size={14} className="animate-pulse" aria-hidden="true" /> Slide to cancel
          </span>
        ) : (
          <span className="flex-1 min-w-0 flex items-center gap-[2px] h-6 overflow-hidden" aria-hidden="true">
            {bars.map((l, i) => (
              <span key={i} className="flex-1 min-w-[2px] rounded-full bg-[#DC143C]/80" style={{ height: `${Math.max(8, Math.round(l * 100))}%` }} />
            ))}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={rec.stop}
        disabled={rec.state !== 'recording'}
        className="w-10 h-10 rounded-xl bg-[#DC143C] hover:bg-[#FF1744] flex items-center justify-center flex-shrink-0 disabled:opacity-60"
        aria-label="Stop recording"
      >
        <Square size={14} className="text-white" fill="currentColor" />
      </button>
    </div>
  );
}
