'use client';

import type { ViewOnceInfo } from '@/lib/view-once';

/** WhatsApp-style "view once" mark: a dashed ring with a 1 inside. */
export function ViewOnceIcon({ size = 20, className = '', filled = false }: { size?: number; className?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray={filled ? undefined : '3.2 2.4'} strokeLinecap="round" fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.15 : 0} />
      <path d="M10.4 9.2 12.6 7.8V16.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function clock(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function listNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

interface Props {
  info: ViewOnceInfo;
  sent: boolean;
  pending?: boolean;
  /** Several recipients (couple / group chat): name who opened it */
  multi?: boolean;
  nameOf?: (userId: string) => string;
  opening?: boolean;
  onOpen?: () => void;
}

/**
 * The sealed placeholder for a view-once photo or video. No thumbnail or
 * preview exists for these: the bubble only ever shows the type and state.
 */
export default function ViewOnceBubble({ info, sent, pending = false, multi = false, nameOf, opening = false, onOpen }: Props) {
  const label = info.kind === 'video' ? '🎥 Video' : '📸 Photo';
  const corner = sent ? 'rounded-tr-sm' : 'rounded-tl-sm';
  const canOpen = !sent && info.state === 'sealed' && !pending;

  let status: string;
  if (sent) {
    const viewers = (info.views ?? []).map(v => nameOf?.(v.userId) ?? 'Someone');
    if (pending) status = 'Sending…';
    else if (info.state === 'opened' && !multi) status = `Opened${info.views?.[0] ? ` · ${clock(info.views[0].viewedAt)}` : ''}`;
    else if (viewers.length > 0 && multi) status = `Opened by ${listNames(viewers)}`;
    else if (info.state === 'expired') status = 'Expired · not opened';
    // The title already says "· View once"
    else status = 'Delivered';
  } else if (info.state === 'opened') status = `Opened${info.openedAt ? ` · ${clock(info.openedAt)}` : ''}`;
  else if (info.state === 'expired') status = 'Expired';
  else status = 'View once';

  const done = info.state === 'opened' || info.state === 'expired';
  const body = (
    <>
      <span className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${done ? 'bg-white/5 text-white/40' : sent ? 'bg-white/15 text-white' : 'bg-[#DC143C]/15 text-[#FF4D6D]'}`}>
        <ViewOnceIcon size={22} filled={!done} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className={`block text-sm font-medium truncate ${done ? 'text-white/55' : 'text-white'}`}>
          {label}{!done && <span className={sent ? 'text-white/70' : 'text-white/55'}> · View once</span>}
        </span>
        <span className={`block text-xs truncate ${sent ? (info.state === 'opened' || (info.views?.length ?? 0) > 0 ? 'text-[#F5D77A]' : 'text-white/70') : 'text-white/50'}`}>
          {sent ? status : done ? status : opening ? 'Opening…' : 'Tap to open'}
        </span>
      </span>
    </>
  );

  const shell = `flex items-center gap-3 w-[236px] max-w-full px-3 py-2.5 rounded-2xl ${corner} border transition-colors ${
    sent
      ? done ? 'bg-[#DC143C]/35 border-[#DC143C]/30' : 'bg-[#DC143C] border-[#DC143C]'
      : done ? 'bg-white/[0.03] border-white/10' : 'glass border-[#DC143C]/35'
  } ${pending ? 'opacity-60' : ''}`;

  if (canOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        disabled={opening}
        className={`${shell} hover:border-[#DC143C]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37] disabled:cursor-wait`}
        aria-label={`Open view-once ${info.kind}. You can only open it once.`}
      >
        {body}
      </button>
    );
  }
  return <div className={shell} role="group" aria-label={`View-once ${info.kind}: ${status}`}>{body}</div>;
}
