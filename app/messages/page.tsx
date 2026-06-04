'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { Search, Send, MoreVertical, Phone, Video } from 'lucide-react';

interface Conversation {
  id: string;
  username: string;
  displayName?: string;
  initials?: string;
  gradient?: string;
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
  createdAt?: string;
  time?: string;
}

const GRADIENTS = [
  'from-rose-900 to-red-800',
  'from-emerald-900 to-teal-700',
  'from-violet-900 to-purple-700',
  'from-blue-900 to-cyan-800',
  'from-amber-900 to-orange-800',
];

function gradientFor(username: string) {
  const idx = username.charCodeAt(0) % GRADIENTS.length;
  return GRADIENTS[idx];
}

function initialsFor(name: string) {
  return (name || '?').slice(0, 2).toUpperCase();
}

function formatTime(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString();
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchConv, setSearchConv] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeConv = conversations.find((c) => c.id === activeConvId) || null;

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || data || []);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || data || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!activeConvId) return;
    setLoadingMessages(true);
    fetchMessages(activeConvId).finally(() => setLoadingMessages(false));

    // Poll every 5 seconds
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      fetchMessages(activeConvId);
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeConvId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!messageInput.trim() || !activeConvId || sending) return;
    const text = messageInput.trim();
    setMessageInput('');
    setSending(true);

    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      content: text,
      isSent: true,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch(`/api/conversations/${activeConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => prev.map((m) => m.id === tempMsg.id ? { ...data, isSent: true } : m));
        fetchConversations();
      }
    } catch { /* keep temp message */ } finally {
      setSending(false);
    }
  }

  const filteredConvs = conversations.filter((c) => {
    const name = (c.displayName || c.username || '').toLowerCase();
    return name.includes(searchConv.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col">
      <Navbar />

      <main className="flex-1 pt-16 flex overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
        {/* Conversation List */}
        <aside className="w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-white/5 flex flex-col bg-[#0A0A0F]">
          <div className="p-4 border-b border-white/5">
            <h1 className="text-white font-semibold text-lg mb-3">Messages</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
              <input
                type="search"
                placeholder="Search conversations..."
                className="input-dark w-full pl-9 pr-4 py-2 rounded-xl text-sm"
                value={searchConv}
                onChange={(e) => setSearchConv(e.target.value)}
                aria-label="Search conversations"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConvs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-white/30 text-sm">No conversations yet</p>
                <p className="text-white/20 text-xs mt-1">Like someone to start chatting</p>
              </div>
            ) : (
              filteredConvs.map((conv) => {
                const gradient = conv.gradient || gradientFor(conv.username);
                const initials = conv.initials || initialsFor(conv.displayName || conv.username);
                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-left border-b border-white/5 ${activeConvId === conv.id ? 'bg-white/5 border-l-2 border-l-[#DC143C]' : ''}`}
                    aria-label={`Conversation with ${conv.displayName || conv.username}`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                        <span className="text-white text-sm font-bold">{initials}</span>
                      </div>
                      {conv.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-[#0A0A0F] rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-white font-medium text-sm truncate">{conv.displayName || conv.username}</span>
                        <span className="text-white/30 text-xs flex-shrink-0 ml-2">{formatTime(conv.lastMessageAt)}</span>
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
              })
            )}
          </div>
        </aside>

        {/* Conversation Window */}
        {activeConv ? (
          <div className="hidden md:flex flex-1 flex-col min-w-0">
            {/* Header */}
            <div className="glass-dark border-b border-white/5 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${activeConv.gradient || gradientFor(activeConv.username)} flex items-center justify-center`}>
                    <span className="text-white text-sm font-bold">{activeConv.initials || initialsFor(activeConv.displayName || activeConv.username)}</span>
                  </div>
                  {activeConv.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#0A0A0F] rounded-full" />
                  )}
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">{activeConv.displayName || activeConv.username}</div>
                  <div className="text-xs">
                    {activeConv.isOnline ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />Online now
                      </span>
                    ) : (
                      <span className="text-white/40">Offline</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="w-8 h-8 glass rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-colors" aria-label="Voice call"><Phone size={14} /></button>
                <button className="w-8 h-8 glass rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-colors" aria-label="Video call"><Video size={14} /></button>
                <button className="w-8 h-8 glass rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-colors" aria-label="More options"><MoreVertical size={14} /></button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {loadingMessages && (
                <div className="flex justify-center">
                  <div className="w-6 h-6 border-2 border-[#DC143C] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {messages.map((msg) => {
                const isSent = msg.isSent ?? false;
                const time = msg.time || (msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
                return (
                  <div key={msg.id} className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
                    {!isSent && (
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${activeConv.gradient || gradientFor(activeConv.username)} flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1`}>
                        {activeConv.initials || initialsFor(activeConv.displayName || activeConv.username)}
                      </div>
                    )}
                    <div className={`max-w-[70%] flex flex-col gap-1 ${isSent ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        isSent ? 'bg-[#DC143C] text-white rounded-tr-sm' : 'glass text-white/90 rounded-tl-sm'
                      }`}>
                        {msg.content}
                      </div>
                      {time && <span className="text-white/30 text-xs px-1">{time}</span>}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="glass-dark border-t border-white/5 px-4 py-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <textarea
                    placeholder={`Message ${activeConv.displayName || activeConv.username}...`}
                    className="input-dark w-full px-4 py-3 rounded-xl text-sm resize-none min-h-[44px] max-h-32"
                    rows={1}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    aria-label="Type a message"
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!messageInput.trim() || sending}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    messageInput.trim() && !sending
                      ? 'bg-[#DC143C] hover:bg-[#FF1744]'
                      : 'glass text-white/30 cursor-not-allowed'
                  }`}
                  aria-label="Send message"
                >
                  <Send size={16} className="text-white" />
                </button>
              </div>
              <p className="text-white/20 text-xs mt-2 text-center">Messages are end-to-end encrypted</p>
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
        )}
      </main>
    </div>
  );
}
