'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import EmptyState from '@/components/EmptyState';
import { useSession } from 'next-auth/react';
import { Search, Send, Heart, ArrowLeft } from 'lucide-react';

interface Conversation {
  id: string;
  username: string;
  displayName?: string;
  profilePhoto?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  isOnline?: boolean;
}

interface Message {
  id: string;
  content: string;
  senderId?: string;
  isSent?: boolean;
  isRead?: boolean;
  createdAt?: string;
}

const GRADIENTS = [
  'from-rose-900 to-red-800',
  'from-emerald-900 to-teal-700',
  'from-violet-900 to-purple-700',
  'from-blue-900 to-cyan-800',
  'from-amber-900 to-orange-800',
];

function gradientFor(u: string) { return GRADIENTS[u.charCodeAt(0) % GRADIENTS.length]; }
function initialsFor(n: string) { return (n || '?').slice(0, 2).toUpperCase(); }
function fmtTime(d?: string) {
  if (!d) return '';
  const dt = new Date(d), now = new Date(), diff = now.getTime() - dt.getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return dt.toLocaleDateString();
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);
  const convPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeConv = conversations.find(c => c.id === activeConvId) ?? null;

  // ── Fetch conversations (+ poll every 15s for list updates) ───────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || data || []);
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
        const msgs: Message[] = (data.messages || data || []).map((m: Message & { senderId?: string }) => ({
          ...m,
          isSent: m.senderId === myId,
        }));
        setMessages(msgs);
      }
    } finally { setLoadingMsgs(false); }
  }, [myId]);

  // ── Subscribe to SSE stream for real-time messages ────────────────────────
  useEffect(() => {
    if (!activeConvId) return;

    setMessages([]);
    loadMessages(activeConvId);

    // Close any existing SSE connection
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
          setMessages(prev => {
            // Avoid duplicates (temp messages get replaced)
            const filtered = prev.filter(m => !m.id.startsWith('temp-') || m.content !== msg.content);
            if (filtered.some(m => m.id === msg.id)) return filtered;
            return [...filtered, msg];
          });
          // Refresh conversation list for unread counts
          fetchConversations();
        }
      } catch { /* ignore */ }
    };

    sse.onerror = () => { sse.close(); };

    return () => { sse.close(); sseRef.current = null; };
  }, [activeConvId, loadMessages, fetchConversations, myId]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────
  async function handleSend() {
    if (!input.trim() || !activeConvId || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, content: text, isSent: true, createdAt: new Date().toISOString() }]);

    try {
      const res = await fetch(`/api/conversations/${activeConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const data = await res.json();
        const saved: Message = { ...data.message ?? data, isSent: true };
        setMessages(prev => prev.map(m => m.id === tempId ? saved : m));
        fetchConversations();
      }
    } catch { /* keep temp */ } finally { setSending(false); }
  }

  function openConv(convId: string) {
    setActiveConvId(convId);
    setMobileView('chat');
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
              className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-left border-b border-white/5 ${active ? 'bg-white/5 border-l-2 border-l-[#DC143C]' : ''}`}
            >
              <div className="relative flex-shrink-0">
                {conv.profilePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={conv.profilePhoto} alt={conv.username} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center`}>
                    <span className="text-white text-sm font-bold">{init}</span>
                  </div>
                )}
                {conv.isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-[#0A0A0F] rounded-full" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-white font-medium text-sm truncate">{conv.displayName || conv.username}</span>
                  <span className="text-white/30 text-xs flex-shrink-0 ml-2">{fmtTime(conv.lastMessageAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-white/50 text-xs truncate">{conv.lastMessage || 'Start a conversation'}</p>
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
              <span className="text-white text-sm font-bold">{initialsFor(activeConv.displayName || activeConv.username)}</span>
            </div>
          )}
          {activeConv.isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#0A0A0F] rounded-full" />}
        </div>
        <div>
          <div className="text-white font-semibold text-sm">{activeConv.displayName || activeConv.username}</div>
          <div className="text-xs">
            {activeConv.isOnline
              ? <span className="text-emerald-400">● Online now</span>
              : <span className="text-white/40">Offline</span>}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
        {loadingMsgs && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#DC143C] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {messages.map(msg => {
          const sent = msg.isSent ?? false;
          const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          const isTemp = msg.id.startsWith('temp-');
          return (
            <div key={msg.id} className={`flex ${sent ? 'justify-end' : 'justify-start'}`}>
              {!sent && (
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradientFor(activeConv.username)} flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1`}>
                  {initialsFor(activeConv.displayName || activeConv.username)}
                </div>
              )}
              <div className={`max-w-[72%] flex flex-col gap-1 ${sent ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${sent ? 'bg-[#DC143C] text-white rounded-tr-sm' : 'glass text-white/90 rounded-tl-sm'} ${isTemp ? 'opacity-60' : ''}`}>
                  {msg.content}
                </div>
                <div className="flex items-center gap-1 px-1">
                  {time && <span className="text-white/25 text-xs">{time}</span>}
                  {sent && !isTemp && (
                    <span className={`text-xs ${msg.isRead ? 'text-[#DC143C]' : 'text-white/30'}`} title={msg.isRead ? 'Read' : 'Delivered'}>
                      {msg.isRead ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="glass-dark border-t border-white/5 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            placeholder={`Message ${activeConv.displayName || activeConv.username}...`}
            className="input-dark flex-1 px-4 py-2.5 rounded-xl text-sm resize-none min-h-[44px] max-h-32"
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${input.trim() && !sending ? 'bg-[#DC143C] hover:bg-[#FF1744]' : 'glass text-white/30 cursor-not-allowed'}`}
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
