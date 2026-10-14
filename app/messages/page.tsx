'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import EmptyState from '@/components/EmptyState';
import MessageBubble, { type ChatMessage } from '@/components/chat/MessageBubble';
import ExpiryCountdown from '@/components/chat/ExpiryCountdown';
import Icebreakers from '@/components/chat/Icebreakers';
import { useSession } from 'next-auth/react';
import { Search, Send, Heart, ArrowLeft, ImagePlus, X, Crown, Users, ChevronDown } from 'lucide-react';
import type { Reactions } from '@/lib/reactions';

interface Avatar { name: string; photo?: string | null; username?: string }

interface Conversation {
  id: string;
  username: string;
  displayName?: string;
  profilePhoto?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  isOnline?: boolean;
  matchExpiresAt?: string | null;
  expired?: boolean;
  isCouple?: boolean;
  participantCount?: number;
  avatars?: Avatar[];
  partnerName?: string | null;
}

interface Side {
  userIds: string[];
  label: string;
  isCouple: boolean;
  kind: 'single' | 'linked' | 'shared';
  members: { id: string; username: string; name: string; photo: string | null; isOnline: boolean }[];
}

interface ParticipantInfo {
  name: string;
  username: string;
  photo: string | null;
  coupleLabel: string | null;
  isMyPartner: boolean;
  isMe: boolean;
}

interface ConvInfo {
  conversation: {
    id: string;
    hasMessages: boolean;
    matchExpiresAt: string | null;
    expired: boolean;
    blocked?: boolean;
    participantCount?: number;
    sides?: Side[];
    participants?: Record<string, ParticipantInfo>;
    partner?: { id: string; name: string } | null;
  };
  me: { isPaid: boolean; showChatImages: boolean; coupleNames?: string[] };
  icebreakers: string[];
}

interface Receipt { messageId: string; seenBy: string[]; allSeen: boolean; readAt: string | null }

type Message = ChatMessage;

const GRADIENTS = [
  'from-rose-900 to-red-800',
  'from-emerald-900 to-teal-700',
  'from-violet-900 to-purple-700',
  'from-blue-900 to-cyan-800',
  'from-amber-900 to-orange-800',
];

const TYPING_THROTTLE_MS = 2000;
const RR_HINT_KEY = 'velour_rr_hint_shown';
const SEND_AS_KEY = 'hush_send_as';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function gradientFor(u: string) { return GRADIENTS[(u || '?').charCodeAt(0) % GRADIENTS.length]; }
function initialsFor(n: string) { return (n || '?').slice(0, 2).toUpperCase(); }
function fmtTime(d?: string) {
  if (!d) return '';
  const dt = new Date(d), now = new Date(), diff = now.getTime() - dt.getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return dt.toLocaleDateString();
}
function clock(d?: string | null) {
  return d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}
function listNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Round avatar: photo or initials on a gradient. */
function Face({ name, photo, seed, size, ring = false, grayscale = false, oneLetter = false, back = false }: {
  name: string; photo?: string | null; seed: string; size: number; ring?: boolean; grayscale?: boolean; oneLetter?: boolean;
  /** Rear face of a stack: nudge the initial up-left, clear of the front face */
  back?: boolean;
}) {
  const style = back
    ? { width: size, height: size, paddingRight: Math.round(size * 0.3), paddingBottom: Math.round(size * 0.3) }
    : { width: size, height: size };
  const ringCls = ring ? 'ring-2 ring-[#0A0A0F]' : '';
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" width={size} height={size} loading="lazy" style={{ width: size, height: size }} className={`rounded-full object-cover flex-shrink-0 ${ringCls} ${grayscale ? 'grayscale' : ''}`} />;
  }
  return (
    <div style={style} className={`rounded-full bg-gradient-to-br ${gradientFor(seed)} flex items-center justify-center flex-shrink-0 ${ringCls}`}>
      <span className="text-white font-bold" style={{ fontSize: Math.max(10, Math.round(size * (oneLetter ? 0.42 : 0.32))) }}>{oneLetter ? initialsFor(name).charAt(0) : initialsFor(name)}</span>
    </div>
  );
}

/** One face, or two overlapping faces for a couple / group. */
function AvatarStack({ avatars, size, grayscale }: { avatars: Avatar[]; size: number; grayscale?: boolean }) {
  if (avatars.length < 2) {
    const a = avatars[0] ?? { name: '?' };
    return <Face name={a.name} photo={a.photo} seed={a.username || a.name} size={size} grayscale={grayscale} />;
  }
  const small = Math.round(size * 0.7);
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      <div className="absolute top-0 left-0">
        <Face name={avatars[0].name} photo={avatars[0].photo} seed={avatars[0].username || avatars[0].name} size={small} grayscale={grayscale} oneLetter back />
      </div>
      <div className="absolute bottom-0 right-0">
        <Face name={avatars[1].name} photo={avatars[1].photo} seed={avatars[1].username || avatars[1].name} size={small} ring grayscale={grayscale} oneLetter />
      </div>
    </div>
  );
}

function CoupleBadge() {
  return (
    <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium text-[#D4AF37] border border-[#D4AF37]/30 rounded-full px-1.5 py-px leading-none">
      <Users size={9} aria-hidden="true" /> Couple
    </span>
  );
}

export default function MessagesPage() {
  const { data: session } = useSession();
  const myId = (session?.user as { id?: string })?.id ?? '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [info, setInfo] = useState<ConvInfo | null>(null);
  // userId → name override (shared couple account partner) for everyone typing
  const [typing, setTyping] = useState<Record<string, string | null>>({});
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{ url: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRrHint, setShowRrHint] = useState(false);
  const [convsLoaded, setConvsLoaded] = useState(false);
  const [sendAs, setSendAs] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sseRef = useRef<EventSource | null>(null);
  const convPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTypingSentRef = useRef(0);

  const activeConv = conversations.find(c => c.id === activeConvId) ?? null;
  const isPaidUser = info?.me.isPaid ?? false;
  const blurImages = !(info?.me.showChatImages ?? false);
  const expiresAt = messages.length === 0 ? (info?.conversation.matchExpiresAt ?? activeConv?.matchExpiresAt ?? null) : null;
  const expired = messages.length === 0 && (info?.conversation.expired ?? activeConv?.expired ?? false);
  const blocked = !!info?.conversation.blocked;
  const participants = info?.conversation.participants ?? {};
  const sides = info?.conversation.sides ?? [];
  const partner = info?.conversation.partner ?? null;
  const coupleNames = info?.me.coupleNames ?? [];
  const participantCount = info?.conversation.participantCount ?? activeConv?.participantCount ?? 2;
  // Name every message once more than two people are in the room, or a couple is involved
  const showSenders = participantCount > 2 || sides.some(s => s.isCouple) || coupleNames.length >= 2;

  // ── Read-receipt upsell hint: shown at most once per browser ──────────────
  useEffect(() => {
    try { setShowRrHint(!localStorage.getItem(RR_HINT_KEY)); } catch { setShowRrHint(false); }
  }, []);

  // ── Shared couple account: remember "Sending as" per device ───────────────
  useEffect(() => {
    if (coupleNames.length < 2) return;
    let saved = '';
    try { saved = localStorage.getItem(`${SEND_AS_KEY}:${myId}`) ?? ''; } catch { /* ignore */ }
    setSendAs(prev => (coupleNames.includes(prev) ? prev : coupleNames.includes(saved) ? saved : coupleNames[0]));
  }, [coupleNames.join('|'), myId]); // eslint-disable-line react-hooks/exhaustive-deps

  function chooseSendAs(name: string) {
    setSendAs(name);
    try { localStorage.setItem(`${SEND_AS_KEY}:${myId}`, name); } catch { /* ignore */ }
  }

  // ── Auto-open conversation from URL ?conv= ────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get('conv');
    if (convId) {
      setActiveConvId(convId);
      setMobileView('chat');
      // Clean up URL without reload
      window.history.replaceState({}, '', '/messages');
    }
  }, []);

  // ── Fetch conversations (+ poll every 15s for list updates) ───────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json() as { conversations?: Conversation[] };
        setConversations(data.conversations || []);
      }
    } catch { /* ignore */ }
    finally { setConvsLoaded(true); }
  }, []);

  useEffect(() => {
    fetchConversations();
    convPollRef.current = setInterval(fetchConversations, 15000);
    return () => { if (convPollRef.current) clearInterval(convPollRef.current); };
  }, [fetchConversations]);

  const applyReceipt = useCallback((r: Receipt | null | undefined) => {
    if (!r) return;
    setMessages(prev => prev.map(m => m.id === r.messageId
      ? { ...m, isRead: r.allSeen, seenBy: r.seenBy, readAt: r.readAt ?? m.readAt ?? null }
      : m));
  }, []);

  // ── Load full message history when switching conversations ────────────────
  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const msgs: Message[] = (data.messages || data || []).map((m: Message) => ({
          ...m,
          isSent: m.senderId === myId,
        }));
        setMessages(msgs);
        applyReceipt(data.receipt as Receipt | null);
      }
    } finally { setLoadingMsgs(false); }
  }, [myId, applyReceipt]);

  const loadInfo = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}`);
      if (res.ok) setInfo(await res.json() as ConvInfo);
    } catch { /* ignore */ }
  }, []);

  // ── Subscribe to SSE stream for real-time updates ─────────────────────────
  useEffect(() => {
    if (!activeConvId) return;

    setMessages([]);
    setInfo(null);
    setTyping({});
    setPickerFor(null);
    setPendingImage(null);
    setError(null);
    loadMessages(activeConvId);
    loadInfo(activeConvId);

    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let stopped = false;

    function connect() {
      sseRef.current?.close();
      const sse = new EventSource(`/api/conversations/stream/${activeConvId}`);
      sseRef.current = sse;

      sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'message') {
            const msg: Message = {
              ...data.message,
              isSent: data.message.senderId === myId,
            };
            if (!msg.isSent && msg.senderId) {
              const sid = msg.senderId;
              setTyping(prev => { if (!(sid in prev)) return prev; const n = { ...prev }; delete n[sid]; return n; });
            }
            setMessages(prev => {
              const filtered = prev.filter(m =>
                !m.id.startsWith('temp-') || m.content !== msg.content || (m.imageUrl ?? null) !== (msg.imageUrl ?? null));
              if (filtered.some(m => m.id === msg.id)) return filtered;
              return [...filtered, msg];
            });
            fetchConversations();
          } else if (data.type === 'typing') {
            if (data.userId !== myId) {
              const uid = data.userId as string;
              setTyping(prev => {
                const n = { ...prev };
                if (data.isTyping) n[uid] = (data.name as string | undefined) ?? null; else delete n[uid];
                return n;
              });
            }
          } else if (data.type === 'receipt') {
            applyReceipt(data as Receipt);
          } else if (data.type === 'reaction') {
            setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions as Reactions } : m));
          } else if (data.type === 'participants') {
            if (activeConvId) loadInfo(activeConvId);
            fetchConversations();
          } else if (data.type === 'revoked') {
            stopped = true;
            sse.close();
            setActiveConvId(null);
            setMobileView('list');
            fetchConversations();
          } else if (data.type === 'connected') {
            attempts = 0;
          }
        } catch { /* ignore */ }
      };

      sse.onerror = () => {
        sse.close();
        if (stopped) return;
        // Reconnect with backoff (max 30s)
        const delay = Math.min(1000 * 2 ** attempts, 30000);
        attempts++;
        retryTimeout = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      stopped = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, [activeConvId, loadMessages, loadInfo, fetchConversations, myId, applyReceipt]);

  const typingIds = Object.keys(typing);
  const nameOf = useCallback((uid: string, partnerName?: string | null) =>
    partnerName || participants[uid]?.name || 'Someone', [participants]);
  const typingNames = typingIds.map(uid => nameOf(uid, typing[uid]));
  const someoneTyping = typingIds.length > 0;
  const typingText = someoneTyping
    ? `${listNames(typingNames)} ${typingNames.length > 1 ? 'are' : 'is'} typing…`
    : '';

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  const scrollToEnd = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  useEffect(() => { scrollToEnd(); }, [messages.length, someoneTyping, scrollToEnd]);

  // ── Close reaction picker on outside tap ──────────────────────────────────
  useEffect(() => {
    if (!pickerFor) return;
    const close = () => setPickerFor(null);
    const t = setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
    return () => { clearTimeout(t); document.removeEventListener('click', close); };
  }, [pickerFor]);

  // ── Typing indicator (throttled) ──────────────────────────────────────────
  function notifyTyping() {
    if (!activeConvId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    fetch(`/api/conversations/${activeConvId}/typing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isTyping: true, ...(sendAs && coupleNames.length >= 2 ? { as: sendAs } : {}) }),
    }).catch(() => {});
  }

  // ── Image attach ──────────────────────────────────────────────────────────
  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith('image/')) { setError('Only images can be sent'); return; }
    if (file.size > MAX_IMAGE_BYTES) { setError('Image must be under 10MB'); return; }
    const preview = URL.createObjectURL(file);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      // Chat photos are stored privately (only conversation participants can view)
      form.append('purpose', 'chat');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({})) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed');
      setPendingImage({ url: data.url, preview });
    } catch (e) {
      URL.revokeObjectURL(preview);
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function clearPendingImage() {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
  }

  // ── Send message ──────────────────────────────────────────────────────────
  const canSend = (!!input.trim() || !!pendingImage) && !sending && !uploading && !expired && !blocked;

  async function handleSend() {
    if (!canSend || !activeConvId) return;
    const text = input.trim();
    const image = pendingImage;
    const as = coupleNames.length >= 2 && sendAs ? sendAs : null;
    setInput('');
    setPendingImage(null);
    setSending(true);
    setError(null);
    lastTypingSentRef.current = 0;

    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId, content: text, imageUrl: image?.url ?? null, isSent: true, senderId: myId,
      senderPartnerName: as, createdAt: new Date().toISOString(),
    }]);

    try {
      const res = await fetch(`/api/conversations/${activeConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          ...(image ? { imageUrl: image.url } : {}),
          ...(as ? { senderPartnerName: as } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const saved: Message = { ...(data.message ?? data), isSent: true };
        setMessages(prev => {
          if (prev.some(m => m.id === saved.id)) return prev.filter(m => m.id !== tempId);
          return prev.map(m => m.id === tempId ? saved : m);
        });
        if (image) URL.revokeObjectURL(image.preview);
        setInfo(prev => prev ? { ...prev, icebreakers: [], conversation: { ...prev.conversation, hasMessages: true, matchExpiresAt: null } } : prev);
        fetchConversations();
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setInput(text);
        if (image) setPendingImage(image);
        setError((data as { error?: string }).error || 'Message failed to send');
      }
    } catch { /* keep temp */ } finally { setSending(false); }
  }

  // ── Reactions ─────────────────────────────────────────────────────────────
  async function handleReact(messageId: string, emoji: string) {
    if (!activeConvId || !myId) return;
    // Optimistic toggle
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const r: Reactions = { ...(m.reactions ?? {}) };
      const users = r[emoji] ?? [];
      const next = users.includes(myId) ? users.filter(u => u !== myId) : [...users, myId];
      if (next.length) r[emoji] = next; else delete r[emoji];
      return { ...m, reactions: r };
    }));
    try {
      const res = await fetch(`/api/conversations/${activeConvId}/messages/${messageId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        const data = await res.json() as { reactions: Reactions };
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions: data.reactions } : m));
      }
    } catch { /* stream will reconcile */ }
  }

  function openConv(convId: string) {
    setActiveConvId(convId);
    setMobileView('chat');
  }

  function pickIcebreaker(text: string) {
    setInput(text);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) { ta.focus(); ta.setSelectionRange(text.length, text.length); }
    });
  }

  // Latest message I sent — the only one that gets a receipt line
  let lastSentId: string | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].isSent && !messages[i].id.startsWith('temp-')) { lastSentId = messages[i].id; break; }
  }
  const rrHintVisible = !!info && !isPaidUser && showRrHint && !!lastSentId;
  useEffect(() => {
    if (rrHintVisible) { try { localStorage.setItem(RR_HINT_KEY, '1'); } catch { /* ignore */ } }
  }, [rrHintVisible]);

  const multiRecipients = participantCount > 2;

  function receiptFor(msg: Message) {
    if (msg.id !== lastSentId) return null;
    if (isPaidUser) {
      if (msg.isRead) {
        return <span className="text-xs text-[#D4AF37]">Seen{!multiRecipients && msg.readAt ? ` ${clock(msg.readAt)}` : ''}</span>;
      }
      const seen = (msg.seenBy ?? []).map(u => participants[u]?.name).filter((n): n is string => !!n);
      if (multiRecipients && seen.length > 0) {
        return <span className="text-xs text-[#D4AF37]/80 truncate">Seen by {listNames(seen)}</span>;
      }
      return <span className="text-xs text-white/55">Delivered</span>;
    }
    return (
      <span className="flex flex-wrap items-center justify-end gap-x-1.5">
        <span className="text-xs text-white/55">Delivered</span>
        {rrHintVisible && (
          <Link href="/upgrade" className="flex items-center gap-0.5 whitespace-nowrap text-[11px] text-[#D4AF37]/70 hover:text-[#D4AF37]">
            <Crown size={10} /> See read receipts with Gold
          </Link>
        )}
      </span>
    );
  }

  const filtered = conversations.filter(c =>
    (c.displayName || c.username || '').toLowerCase().includes(search.toLowerCase())
  );

  // ── Conversation list ─────────────────────────────────────────────────────
  const ConvList = (
    <aside className={`${mobileView === 'list' ? 'flex' : 'hidden'} md:flex w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-white/5 flex-col bg-[#0A0A0F]`}>
      <div className="p-4 border-b border-white/5">
        <h1 className="font-serif text-white font-bold text-2xl mb-3">Messages</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/55" size={14} aria-hidden="true" />
          <input
            type="search"
            aria-label="Search conversations"
            placeholder="Search conversations…"
            className="input-dark w-full pl-9 pr-4 py-2 rounded-xl text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {!convsLoaded ? (
          <div aria-busy="true" aria-label="Loading conversations">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5">
                <div className="w-12 h-12 rounded-full skeleton flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded skeleton" />
                  <div className="h-3 w-2/3 rounded skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState
            compact
            icon={Heart}
            title="Your inbox is quiet — for now"
            description="Conversations open when you match. Like a few profiles in Discover to get things started."
            action={{ label: 'Start discovering', href: '/discover' }}
            secondaryAction={{ label: 'See my matches', href: '/matches' }}
          />
        ) : filtered.length === 0 ? (
          <p className="text-white/60 text-sm text-center px-6 py-10">No conversations match “{search}”.</p>
        ) : filtered.map(conv => {
          const active = conv.id === activeConvId;
          const name = conv.displayName || conv.username;
          const avatars: Avatar[] = conv.avatars?.length
            ? conv.avatars
            : [{ name, photo: conv.profilePhoto, username: conv.username }];
          return (
            <button
              key={conv.id}
              onClick={() => openConv(conv.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-left border-b border-white/5 ${active ? 'bg-white/5 border-l-2 border-l-[#DC143C]' : ''} ${conv.expired ? 'opacity-50' : ''}`}
            >
              <div className="relative flex-shrink-0">
                <AvatarStack avatars={avatars} size={48} grayscale={conv.expired} />
                {conv.isOnline && !conv.expired && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-[#0A0A0F] rounded-full" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5 gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-white font-medium text-sm truncate">{name}</span>
                    {conv.isCouple && <CoupleBadge />}
                  </span>
                  <span className="text-white/55 text-xs flex-shrink-0">{fmtTime(conv.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  {conv.matchExpiresAt && !conv.lastMessage ? (
                    <ExpiryCountdown expiresAt={conv.matchExpiresAt} />
                  ) : (
                    <p className="text-white/65 text-xs truncate">{conv.lastMessage || 'Start a conversation'}</p>
                  )}
                  {(conv.unreadCount ?? 0) > 0 && (
                    <span className="flex-shrink-0 ml-2 min-w-5 h-5 bg-[#DC143C] rounded-full text-white text-xs font-bold flex items-center justify-center px-1">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
                {conv.partnerName && (
                  <p className="text-[11px] text-[#D4AF37]/70 truncate mt-0.5">Shared with {conv.partnerName}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );

  // ── Chat window ────────────────────────────────────────────────────────────
  const name = sides.length ? sides.map(s => s.label).join(', ') : (activeConv ? (activeConv.displayName || activeConv.username) : '');
  const headerAvatars: Avatar[] = sides.length
    ? sides.flatMap(s => s.members).map(m => ({ name: m.name, photo: m.photo, username: m.username }))
    : activeConv?.avatars?.length
      ? activeConv.avatars
      : activeConv ? [{ name, photo: activeConv.profilePhoto, username: activeConv.username }] : [];
  const headerIsCouple = sides.length ? sides.some(s => s.isCouple) : !!activeConv?.isCouple;
  const onlineMembers = sides.flatMap(s => s.members).filter(m => m.isOnline);
  const anyOnline = sides.length ? onlineMembers.length > 0 : !!activeConv?.isOnline;
  const memberCount = sides.reduce((n, s) => n + s.members.length, 0);

  function senderAvatar(msg: Message, show: boolean): ReactNode {
    if (!show) return <div className="w-8 mr-2 flex-shrink-0" aria-hidden="true" />;
    const p = msg.senderId ? participants[msg.senderId] : undefined;
    const n = msg.senderPartnerName || p?.name || msg.sender?.profile?.displayName || msg.sender?.username || name;
    const photo = msg.senderPartnerName ? null : (p?.photo ?? msg.sender?.profile?.profilePhoto ?? (showSenders ? null : activeConv?.profilePhoto));
    return (
      <div className="mr-2 mt-1 flex-shrink-0 self-start">
        <Face name={n} photo={photo} seed={p?.username || msg.sender?.username || n} size={32} />
      </div>
    );
  }

  function senderLabel(msg: Message): ReactNode {
    const p = msg.senderId ? participants[msg.senderId] : undefined;
    if (msg.isSent) {
      // Shared account: make it clear which of us wrote it
      return msg.senderPartnerName ? <span className="text-white/50">as {msg.senderPartnerName}</span> : null;
    }
    const n = msg.senderPartnerName || p?.name || msg.sender?.profile?.displayName || msg.sender?.username;
    if (!n) return null;
    const suffix = p?.isMyPartner ? 'your partner' : (p?.coupleLabel || msg.senderPartnerName) ? 'couple' : null;
    return (
      <>
        <span className="text-white/75 font-medium">{n}</span>
        {suffix && <span className={p?.isMyPartner ? 'text-[#D4AF37]/75' : 'text-white/45'}> · {suffix}</span>}
      </>
    );
  }

  const ChatWindow = activeConv ? (
    <div className={`${mobileView === 'chat' ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`}>
      {/* Header */}
      <div className="glass-dark border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button className="md:hidden w-9 h-9 -ml-2 flex items-center justify-center text-white/70 hover:text-white rounded-lg" onClick={() => setMobileView('list')} aria-label="Back to conversations">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div className="relative flex-shrink-0">
          <AvatarStack avatars={headerAvatars} size={40} />
          {anyOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#0A0A0F] rounded-full" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-white font-semibold text-sm truncate">{name}</span>
            {headerIsCouple && <CoupleBadge />}
          </div>
          <div className="text-xs truncate">
            {someoneTyping
              ? <span className="text-[#D4AF37]">{showSenders ? typingText : 'typing…'}</span>
              : anyOnline
                ? <span className="text-emerald-400">● {memberCount > 1 ? `${listNames(onlineMembers.map(m => m.name))} online` : 'Online now'}</span>
                : <span className="text-white/60">Offline</span>}
            {partner && !someoneTyping && <span className="text-white/50"> · with {partner.name}</span>}
          </div>
        </div>
        {expiresAt && (
          <ExpiryCountdown expiresAt={expiresAt} nudge className="items-end text-right flex-shrink-0" />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-12 pb-6 space-y-3">
        {loadingMsgs && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#DC143C] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loadingMsgs && messages.length === 0 && (
          expired ? (
            <div className="text-center py-10">
              <p className="text-white/65 text-sm">This match expired before anyone said hi.</p>
              <Link href="/discover" className="text-[#DC143C] hover:text-[#FF1744] text-sm mt-2 inline-block">Keep discovering</Link>
            </div>
          ) : (
            <Icebreakers suggestions={info?.icebreakers ?? []} name={name} onPick={pickIcebreaker} />
          )
        )}
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const runStart = !prev || prev.senderId !== msg.senderId ||
            (prev.senderPartnerName ?? null) !== (msg.senderPartnerName ?? null) || !!prev.isSent !== !!msg.isSent;
          const label = showSenders && runStart ? senderLabel(msg) : null;
          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              myId={myId}
              blurReceivedImages={blurImages}
              avatar={senderAvatar(msg, !showSenders || runStart)}
              senderLabel={label}
              fromPartner={!!msg.senderId && !!participants[msg.senderId]?.isMyPartner}
              footer={msg.isSent && !msg.id.startsWith('temp-') ? receiptFor(msg) : null}
              pickerOpen={pickerFor === msg.id}
              onOpenPicker={() => setPickerFor(msg.id)}
              onClosePicker={() => setPickerFor(p => (p === msg.id ? null : p))}
              onReact={(emoji) => handleReact(msg.id, emoji)}
              onImageLoad={msg.id === messages[messages.length - 1]?.id ? scrollToEnd : undefined}
            />
          );
        })}
        {someoneTyping && (
          <div className="flex items-center gap-2 text-white/60 text-xs pl-1" aria-live="polite">
            <span className="glass rounded-2xl rounded-tl-sm px-3 py-2 flex gap-1">
              <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            {showSenders ? typingText : `${name} is typing…`}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="glass-dark border-t border-white/5 px-4 py-3">
        {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
        {blocked && <p className="text-white/60 text-xs mb-2">You can no longer message in this conversation.</p>}
        {coupleNames.length >= 2 && !blocked && (
          <div className="mb-2 flex items-center gap-1.5 text-xs text-white/55">
            <span>Sending as</span>
            <label className="relative inline-flex items-center">
              <span className="sr-only">Choose who is sending</span>
              <select
                value={sendAs}
                onChange={e => chooseSendAs(e.target.value)}
                className="appearance-none bg-white/5 border border-[#D4AF37]/30 hover:border-[#D4AF37]/60 text-[#D4AF37] font-medium rounded-full pl-2.5 pr-6 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/60 cursor-pointer"
              >
                {coupleNames.map(n => <option key={n} value={n} className="bg-[#0A0A0F] text-white">{n}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-1.5 text-[#D4AF37] pointer-events-none" aria-hidden="true" />
            </label>
          </div>
        )}
        {(pendingImage || uploading) && (
          <div className="mb-2 flex items-center gap-2">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center">
              {pendingImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pendingImage.preview} alt="Attachment" className="w-full h-full object-cover" />
              ) : (
                <div className="w-5 h-5 border-2 border-[#DC143C] border-t-transparent rounded-full animate-spin" />
              )}
              {pendingImage && (
                <button
                  type="button"
                  onClick={clearPendingImage}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center"
                  aria-label="Remove image"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <span className="text-white/60 text-xs">{uploading ? 'Uploading…' : 'Photo attached'}</span>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || expired || blocked}
            className="w-10 h-10 rounded-xl glass flex items-center justify-center text-white/65 hover:text-white disabled:opacity-40 flex-shrink-0 transition-colors"
            aria-label="Attach photo"
          >
            <ImagePlus size={18} />
          </button>
          <textarea
            ref={textareaRef}
            aria-label={`Message ${name}`}
            placeholder={blocked ? 'Messaging unavailable' : expired ? 'This match has expired' : `Message ${name}…`}
            className="input-dark flex-1 min-w-0 px-4 py-2.5 rounded-xl text-sm resize-none min-h-[44px] max-h-32"
            rows={1}
            value={input}
            disabled={expired || blocked}
            maxLength={2000}
            onChange={e => { setInput(e.target.value); if (e.target.value.trim()) notifyTyping(); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${canSend ? 'bg-[#DC143C] hover:bg-[#FF1744]' : 'glass text-white/55 cursor-not-allowed'}`}
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Send size={16} className="text-white" />}
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="hidden md:flex flex-1 items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full glass flex items-center justify-center mx-auto mb-4">
          <Send size={24} className="text-white/45" />
        </div>
        <p className="text-white/80 font-medium">Pick up where you left off</p>
        <p className="text-white/60 text-sm mt-1">Choose a conversation to start chatting.</p>
      </div>
    </div>
  );

  return (
    <div className="bg-[#0A0A0F] flex flex-col">
      <Navbar />
      {/* Mobile: leave room for the fixed bottom tab bar (its in-flow spacer follows the page). */}
      <main className="pt-16 flex overflow-hidden h-chat">
        {ConvList}
        {ChatWindow}
      </main>
    </div>
  );
}
