'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import EmptyState from '@/components/EmptyState';
import MessageBubble, { type ChatMessage } from '@/components/chat/MessageBubble';
import ExpiryCountdown from '@/components/chat/ExpiryCountdown';
import Icebreakers from '@/components/chat/Icebreakers';
import { useSession } from 'next-auth/react';
import { Search, Send, Heart, ArrowLeft, ImagePlus, X, Crown } from 'lucide-react';
import type { Reactions } from '@/lib/reactions';

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
}

interface ConvInfo {
  conversation: { id: string; hasMessages: boolean; matchExpiresAt: string | null; expired: boolean };
  me: { isPaid: boolean; showChatImages: boolean };
  icebreakers: string[];
}

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
  const [otherTyping, setOtherTyping] = useState(false);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{ url: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRrHint, setShowRrHint] = useState(false);

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

  // ── Read-receipt upsell hint: shown at most once per browser ──────────────
  useEffect(() => {
    try { setShowRrHint(!localStorage.getItem(RR_HINT_KEY)); } catch { setShowRrHint(false); }
  }, []);

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
  }, []);

  useEffect(() => {
    fetchConversations();
    convPollRef.current = setInterval(fetchConversations, 15000);
    return () => { if (convPollRef.current) clearInterval(convPollRef.current); };
  }, [fetchConversations]);

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
      }
    } finally { setLoadingMsgs(false); }
  }, [myId]);

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
    setOtherTyping(false);
    setPickerFor(null);
    setPendingImage(null);
    setError(null);
    loadMessages(activeConvId);
    loadInfo(activeConvId);

    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

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
            if (!msg.isSent) setOtherTyping(false);
            setMessages(prev => {
              const filtered = prev.filter(m =>
                !m.id.startsWith('temp-') || m.content !== msg.content || (m.imageUrl ?? null) !== (msg.imageUrl ?? null));
              if (filtered.some(m => m.id === msg.id)) return filtered;
              return [...filtered, msg];
            });
            fetchConversations();
          } else if (data.type === 'typing') {
            if (data.userId !== myId) setOtherTyping(!!data.isTyping);
          } else if (data.type === 'read') {
            const ids = new Set<string>(data.messageIds as string[]);
            setMessages(prev => prev.map(m => ids.has(m.id) ? { ...m, isRead: true, readAt: data.readAt } : m));
          } else if (data.type === 'reaction') {
            setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, reactions: data.reactions as Reactions } : m));
          } else if (data.type === 'connected') {
            attempts = 0;
          }
        } catch { /* ignore */ }
      };

      sse.onerror = () => {
        sse.close();
        // Reconnect with backoff (max 30s)
        const delay = Math.min(1000 * 2 ** attempts, 30000);
        attempts++;
        retryTimeout = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, [activeConvId, loadMessages, loadInfo, fetchConversations, myId]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  const scrollToEnd = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  useEffect(() => { scrollToEnd(); }, [messages.length, otherTyping, scrollToEnd]);

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
      body: JSON.stringify({ isTyping: true }),
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
  const canSend = (!!input.trim() || !!pendingImage) && !sending && !uploading && !expired;

  async function handleSend() {
    if (!canSend || !activeConvId) return;
    const text = input.trim();
    const image = pendingImage;
    setInput('');
    setPendingImage(null);
    setSending(true);
    setError(null);
    lastTypingSentRef.current = 0;

    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId, content: text, imageUrl: image?.url ?? null, isSent: true, createdAt: new Date().toISOString(),
    }]);

    try {
      const res = await fetch(`/api/conversations/${activeConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, ...(image ? { imageUrl: image.url } : {}) }),
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

  function receiptFor(msg: Message) {
    if (msg.id !== lastSentId) return null;
    if (isPaidUser) {
      return msg.isRead
        ? <span className="text-xs text-[#D4AF37]">Seen{msg.readAt ? ` ${clock(msg.readAt)}` : ''}</span>
        : <span className="text-xs text-white/30">Delivered</span>;
    }
    return (
      <span className="flex items-center gap-1.5">
        <span className="text-xs text-white/30">Delivered</span>
        {rrHintVisible && (
          <Link href="/upgrade" className="flex items-center gap-0.5 text-[11px] text-[#D4AF37]/70 hover:text-[#D4AF37]">
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
        <h1 className="text-white font-semibold text-lg mb-3">Messages</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
          <input
            type="search"
            placeholder="Search conversations..."
            className="input-dark w-full pl-9 pr-4 py-2 rounded-xl text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <EmptyState icon={Heart} title="No conversations yet" description="Match with members to start chatting" action={{ label: 'Discover', href: '/discover' }} />
        ) : filtered.map(conv => {
          const grad = gradientFor(conv.username);
          const init = initialsFor(conv.displayName || conv.username);
          const active = conv.id === activeConvId;
          return (
            <button
              key={conv.id}
              onClick={() => openConv(conv.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-left border-b border-white/5 ${active ? 'bg-white/5 border-l-2 border-l-[#DC143C]' : ''} ${conv.expired ? 'opacity-50' : ''}`}
            >
              <div className="relative flex-shrink-0">
                {conv.profilePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={conv.profilePhoto} alt={conv.username} className={`w-12 h-12 rounded-full object-cover ${conv.expired ? 'grayscale' : ''}`} />
                ) : (
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center`}>
                    <span className="text-white text-sm font-bold">{init}</span>
                  </div>
                )}
                {conv.isOnline && !conv.expired && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-[#0A0A0F] rounded-full" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-white font-medium text-sm truncate">{conv.displayName || conv.username}</span>
                  <span className="text-white/30 text-xs flex-shrink-0 ml-2">{fmtTime(conv.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  {conv.matchExpiresAt && !conv.lastMessage ? (
                    <ExpiryCountdown expiresAt={conv.matchExpiresAt} />
                  ) : (
                    <p className="text-white/50 text-xs truncate">{conv.lastMessage || 'Start a conversation'}</p>
                  )}
                  {(conv.unreadCount ?? 0) > 0 && (
                    <span className="flex-shrink-0 ml-2 min-w-5 h-5 bg-[#DC143C] rounded-full text-white text-xs font-bold flex items-center justify-center px-1">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );

  // ── Chat window ────────────────────────────────────────────────────────────
  const name = activeConv ? (activeConv.displayName || activeConv.username) : '';
  const otherAvatar = activeConv && (
    activeConv.profilePhoto ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={activeConv.profilePhoto} alt="" className="w-8 h-8 rounded-full object-cover mr-2 flex-shrink-0 mt-1" />
    ) : (
      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradientFor(activeConv.username)} flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1`}>
        {initialsFor(name)}
      </div>
    )
  );

  const ChatWindow = activeConv ? (
    <div className={`${mobileView === 'chat' ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`}>
      {/* Header */}
      <div className="glass-dark border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button className="md:hidden text-white/60 hover:text-white mr-1" onClick={() => setMobileView('list')}>
          <ArrowLeft size={20} />
        </button>
        <div className="relative flex-shrink-0">
          {activeConv.profilePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activeConv.profilePhoto} alt={activeConv.username} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradientFor(activeConv.username)} flex items-center justify-center`}>
              <span className="text-white text-sm font-bold">{initialsFor(name)}</span>
            </div>
          )}
          {activeConv.isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#0A0A0F] rounded-full" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm truncate">{name}</div>
          <div className="text-xs">
            {otherTyping
              ? <span className="text-[#D4AF37]">typing…</span>
              : activeConv.isOnline
                ? <span className="text-emerald-400">● Online now</span>
                : <span className="text-white/40">Offline</span>}
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
              <p className="text-white/50 text-sm">This match expired before anyone said hi.</p>
              <Link href="/discover" className="text-[#DC143C] hover:text-[#FF1744] text-sm mt-2 inline-block">Keep discovering</Link>
            </div>
          ) : (
            <Icebreakers suggestions={info?.icebreakers ?? []} name={name} onPick={pickIcebreaker} />
          )
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            myId={myId}
            blurReceivedImages={blurImages}
            avatar={otherAvatar}
            footer={msg.isSent && !msg.id.startsWith('temp-') ? receiptFor(msg) : null}
            pickerOpen={pickerFor === msg.id}
            onOpenPicker={() => setPickerFor(msg.id)}
            onClosePicker={() => setPickerFor(p => (p === msg.id ? null : p))}
            onReact={(emoji) => handleReact(msg.id, emoji)}
            onImageLoad={msg.id === messages[messages.length - 1]?.id ? scrollToEnd : undefined}
          />
        ))}
        {otherTyping && (
          <div className="flex items-center gap-2 text-white/40 text-xs pl-1">
            <span className="glass rounded-2xl rounded-tl-sm px-3 py-2 flex gap-1">
              <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            {name} is typing…
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="glass-dark border-t border-white/5 px-4 py-3">
        {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
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
            <span className="text-white/40 text-xs">{uploading ? 'Uploading…' : 'Photo attached'}</span>
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
            disabled={uploading || expired}
            className="w-10 h-10 rounded-xl glass flex items-center justify-center text-white/50 hover:text-white disabled:opacity-40 flex-shrink-0 transition-colors"
            aria-label="Attach photo"
          >
            <ImagePlus size={18} />
          </button>
          <textarea
            ref={textareaRef}
            placeholder={expired ? 'This match has expired' : `Message ${name}...`}
            className="input-dark flex-1 px-4 py-2.5 rounded-xl text-sm resize-none min-h-[44px] max-h-32"
            rows={1}
            value={input}
            disabled={expired}
            maxLength={2000}
            onChange={e => { setInput(e.target.value); if (e.target.value.trim()) notifyTyping(); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${canSend ? 'bg-[#DC143C] hover:bg-[#FF1744]' : 'glass text-white/30 cursor-not-allowed'}`}
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
          <Send size={24} className="text-white/20" />
        </div>
        <p className="text-white/40 font-medium">Select a conversation</p>
        <p className="text-white/20 text-sm mt-1">Choose from your matches to start chatting</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col">
      <Navbar />
      <main className="flex-1 pt-16 flex overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
        {ConvList}
        {ChatWindow}
      </main>
    </div>
  );
}
