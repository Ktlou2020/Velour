'use client';

import { useRef, useState, type ReactNode } from 'react';
import { EyeOff } from 'lucide-react';
import { REACTION_EMOJIS, type Reactions } from '@/lib/reactions';

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
}

const LONG_PRESS_MS = 450;

export default function MessageBubble({
  msg, myId, blurReceivedImages, avatar, senderLabel, fromPartner = false, footer, pickerOpen, onOpenPicker, onClosePicker, onReact, onImageLoad,
}: Props) {
  const sent = msg.isSent ?? false;
  const isTemp = msg.id.startsWith('temp-');
  const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const [revealed, setRevealed] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const blurred = !!msg.imageUrl && !sent && blurReceivedImages && !revealed;
  const reactionEntries = Object.entries(msg.reactions ?? {}).filter(([, ids]) => ids.length > 0);

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
    <div className={`flex ${sent ? 'justify-end' : 'justify-start'}`}>
      {!sent && avatar}
      <div className={`max-w-[72%] min-w-0 flex flex-col gap-1 ${sent ? 'items-end' : 'items-start'}`}>
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
            <div className={`relative overflow-hidden rounded-2xl ${sent ? 'rounded-tr-sm' : 'rounded-tl-sm'} ${msg.content ? 'mb-1' : ''} ${isTemp ? 'opacity-60' : ''} bg-white/5`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={msg.imageUrl}
                alt="Photo"
                onLoad={onImageLoad}
                className={`block max-h-80 w-auto max-w-full object-cover transition-[filter] duration-300 ${blurred ? 'blur-2xl scale-110' : ''}`}
                draggable={false}
              />
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
          {msg.content && (
            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${sent ? 'bg-[#DC143C] text-white rounded-tr-sm' : `glass text-white/90 rounded-tl-sm ${fromPartner ? 'ring-1 ring-[#D4AF37]/25' : ''}`} ${isTemp ? 'opacity-60' : ''}`}>
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
          {time && <span className="text-white/25 text-xs whitespace-nowrap">{time}</span>}
          {footer}
        </div>
      </div>
    </div>
  );
}
