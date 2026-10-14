'use client';

import { useRef, useState, type ReactNode } from 'react';
import { EyeOff, Zap } from 'lucide-react';
import { REACTION_EMOJIS, type Reactions } from '@/lib/reactions';
import VoiceNotePlayer from '@/components/chat/VoiceNotePlayer';
import VideoBubble from '@/components/chat/VideoBubble';
import { NO_SAVE_STYLE, useViewerMark, watermarkBackground } from '@/components/ProtectedImage';

export interface ChatMessage {
  id: string;
  content: string;
  imageUrl?: string | null;
  senderId?: string;
  /** Shared couple account: which partner wrote it */
  senderPartnerName?: string | null;
  sender?: { id: string; username: string; profile?: { displayName?: string | null; profilePhoto?: string | null } | null } | null;
  isSent?: boolean;
  /** Paid receipts with several recipients: who has read it */
  seenBy?: string[];
  isRead?: boolean;
  readAt?: string | null;
  reactions?: Reactions | null;
  createdAt?: string;
  /** TEXT | IMAGE | VOICE | GAME */
  kind?: string | null;
  audioUrl?: string | null;
  audioDurationSec?: number | null;
  /** VOICE: { waveform }, GAME: GameMeta (redacted for the viewer by the server) */
  meta?: unknown;
  isPriority?: boolean;
}

function videoOf(meta: unknown): { url: string; durationSec: number | null } | null {
  if (!meta || typeof meta !== 'object') return null;
  const m = meta as { videoUrl?: unknown; durationSec?: unknown };
  return typeof m.videoUrl === 'string'
    ? { url: m.videoUrl, durationSec: typeof m.durationSec === 'number' ? m.durationSec : null }
    : null;
}

function waveformOf(meta: unknown): number[] | null {
  if (!meta || typeof meta !== 'object') return null;
  const w = (meta as { waveform?: unknown }).waveform;
  return Array.isArray(w) ? w.filter((x): x is number => typeof x === 'number') : null;
}

interface Props {
  msg: ChatMessage;
  myId: string;
  /** Blur received images until tapped (recipient's showChatImages = false). */
  blurReceivedImages: boolean;
  avatar?: ReactNode;
  /** "Thandi · couple" — shown above the first bubble of a run */
  senderLabel?: ReactNode;
  /** Message from the viewer's own linked partner — subtle gold edge */
  fromPartner?: boolean;
  footer?: ReactNode;
  pickerOpen: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onReact: (emoji: string) => void;
  onImageLoad?: () => void;
  /** Rendered in place of the text for GAME messages */
  gameNode?: ReactNode;
  /** Search: dim bubbles that don't match */
  dimmed?: boolean;
}

const LONG_PRESS_MS = 450;

export default function MessageBubble({
  msg, myId, blurReceivedImages, avatar, senderLabel, fromPartner = false, footer, pickerOpen, onOpenPicker, onClosePicker, onReact, onImageLoad, gameNode, dimmed = false,
}: Props) {
  const sent = msg.isSent ?? false;
  const isTemp = msg.id.startsWith('temp-');
  const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const [revealed, setRevealed] = useState(false);
  const viewerMark = useViewerMark(true);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const blurred = !!msg.imageUrl && !sent && blurReceivedImages && !revealed;
  const reactionEntries = Object.entries(msg.reactions ?? {}).filter(([, ids]) => ids.length > 0);
  const isVoice = msg.kind === 'VOICE' && !!msg.audioUrl;
  const isGame = msg.kind === 'GAME' && !!gameNode;
  const video = msg.kind === 'VIDEO' ? videoOf(msg.meta) : null;
  const priorityRing = msg.isPriority ? 'ring-1 ring-[#D4AF37]/70 shadow-[0_0_18px_-6px_rgba(212,175,55,0.6)]' : '';

  function startPress() {
    if (isTemp) return;
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onOpenPicker();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(15);
    }, LONG_PRESS_MS);
  }
  function cancelPress() {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  }

  const picker = !isTemp && (
    <div
      className={`${pickerOpen ? 'flex' : 'hidden md:group-hover:flex'} absolute -top-10 ${sent ? 'right-0' : 'left-0'} z-20 glass-dark border border-white/10 rounded-full px-1.5 py-1 gap-0.5 shadow-lg shadow-black/40`}
      onMouseLeave={() => { if (pickerOpen) onClosePicker(); }}
    >
      {REACTION_EMOJIS.map((e) => {
        const mine = msg.reactions?.[e]?.includes(myId);
        return (
          <button
            key={e}
            type="button"
            onClick={(ev) => { ev.stopPropagation(); onReact(e); onClosePicker(); }}
            className={`w-8 h-8 rounded-full text-lg leading-none flex items-center justify-center hover:scale-125 hover:bg-white/10 transition-transform ${mine ? 'bg-[#DC143C]/30' : ''}`}
            aria-label={`React ${e}`}
          >
            {e}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={`flex ${sent ? 'justify-end' : 'justify-start'} transition-opacity ${dimmed ? 'opacity-25' : ''}`}>
      {!sent && avatar}
      <div className={`${isGame ? 'max-w-[86%]' : 'max-w-[72%]'} min-w-0 flex flex-col gap-1 ${sent ? 'items-end' : 'items-start'}`}>
        {senderLabel && (
          <div className={`px-1 text-[11px] leading-tight max-w-full truncate ${sent ? 'text-right' : 'text-left'}`}>
            {senderLabel}
          </div>
        )}
        <div
          className="relative group select-none md:select-auto"
          onTouchStart={startPress}
          onTouchEnd={(e) => {
            cancelPress();
            // Swallow the click that follows a long-press so the picker stays open
            if (longPressed.current) { e.preventDefault(); longPressed.current = false; }
          }}
          onTouchMove={cancelPress}
          onContextMenu={(e) => { if (pickerOpen) e.preventDefault(); }}
        >
          {picker}
          {msg.imageUrl && (
            <div
              data-protected=""
              className={`relative overflow-hidden rounded-2xl ${sent ? 'rounded-tr-sm' : 'rounded-tl-sm'} ${msg.content ? 'mb-1' : ''} ${isTemp ? 'opacity-60' : ''} bg-white/5`}
              style={NO_SAVE_STYLE}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={msg.imageUrl}
                alt="Photo"
                onLoad={onImageLoad}
                className={`block max-h-80 w-auto max-w-full object-cover pointer-events-none transition-[filter] duration-300 ${blurred ? 'blur-2xl scale-110' : ''}`}
                style={NO_SAVE_STYLE}
                draggable={false}
              />
              {/* Takes long-presses / right-clicks instead of the <img> (no "Save image") */}
              {!blurred && <span aria-hidden="true" className="absolute inset-0" style={{ touchAction: 'manipulation', ...NO_SAVE_STYLE }} />}
              {!blurred && !sent && viewerMark && (
                <span aria-hidden="true" className="absolute inset-0 pointer-events-none" style={watermarkBackground(viewerMark)} />
              )}
              {blurred && (
                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/30 text-white text-sm font-medium"
                >
                  <EyeOff size={20} className="text-white/80" />
                  Tap to view
                </button>
              )}
            </div>
          )}
          {isVoice && (
            <div className={`rounded-2xl ${sent ? 'rounded-tr-sm' : 'rounded-tl-sm'} ${priorityRing}`}>
              <VoiceNotePlayer
                src={msg.audioUrl!}
                durationSec={msg.audioDurationSec}
                waveform={waveformOf(msg.meta)}
                sent={sent}
                pending={isTemp}
              />
            </div>
          )}
          {video && (
            <div className={`${msg.content ? 'mb-1' : ''} rounded-2xl ${sent ? 'rounded-tr-sm' : 'rounded-tl-sm'} ${priorityRing}`}>
              <VideoBubble
                src={video.url}
                durationSec={video.durationSec}
                sent={sent}
                blurred={!sent && blurReceivedImages}
                pending={isTemp}
                onLoaded={onImageLoad}
              />
            </div>
          )}
          {isGame && <div className={`rounded-2xl ${sent ? 'rounded-tr-sm' : 'rounded-tl-sm'} ${priorityRing}`}>{gameNode}</div>}
          {!isVoice && !isGame && msg.content && (
            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${sent ? 'bg-[#DC143C] text-white rounded-tr-sm' : `glass text-white/90 rounded-tl-sm ${fromPartner && !msg.isPriority ? 'ring-1 ring-[#D4AF37]/25' : ''}`} ${priorityRing} ${isTemp ? 'opacity-60' : ''}`}>
              {msg.content}
            </div>
          )}
        </div>

        {reactionEntries.length > 0 && (
          <div className={`flex flex-wrap gap-1 -mt-0.5 ${sent ? 'justify-end' : 'justify-start'}`}>
            {reactionEntries.map(([emoji, ids]) => {
              const mine = ids.includes(myId);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(emoji)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${mine ? 'bg-[#DC143C]/20 border-[#DC143C]/50 text-white' : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'}`}
                >
                  <span className="text-sm leading-none">{emoji}</span>
                  {ids.length > 1 && <span>{ids.length}</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-1 ${sent ? 'justify-end' : ''}`}>
          {msg.isPriority && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[#D4AF37] whitespace-nowrap">
              <Zap size={10} fill="currentColor" aria-hidden="true" /> Priority
            </span>
          )}
          {time && <span className="text-white/25 text-xs whitespace-nowrap">{time}</span>}
          {footer}
        </div>
      </div>
    </div>
  );
}
