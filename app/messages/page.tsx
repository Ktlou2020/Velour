'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import { Search, Send, Smile, Paperclip, MoreVertical, Phone, Video, MapPin } from 'lucide-react';

const CONVERSATIONS = [
  { id: '1', username: 'Sofia_M', initials: 'SM', gradient: 'from-rose-900 to-red-800', preview: 'That sounds wonderful! I\'d love to...', time: '2m ago', unread: 2, isOnline: true },
  { id: '2', username: 'AnnaParis', initials: 'AP', gradient: 'from-emerald-900 to-teal-700', preview: 'The gallery opens at 7, shall we meet...', time: '1h ago', unread: 0, isOnline: true },
  { id: '3', username: 'LilyRose', initials: 'LR', gradient: 'from-pink-900 to-rose-700', preview: 'Haha yes exactly! Same page 😄', time: '3h ago', unread: 0, isOnline: false },
  { id: '4', username: 'IrinaK', initials: 'IK', gradient: 'from-violet-900 to-purple-700', preview: 'That book is incredible, have you read...', time: 'Yesterday', unread: 1, isOnline: false },
  { id: '5', username: 'ChantalB', initials: 'CB', gradient: 'from-amber-900 to-orange-800', preview: 'Brussels in November is magical 🍫', time: 'Yesterday', unread: 0, isOnline: true },
  { id: '6', username: 'MaxVan', initials: 'MV', gradient: 'from-blue-900 to-cyan-800', preview: 'The cycling route you mentioned...', time: '2 days ago', unread: 0, isOnline: true },
  { id: '7', username: 'TomLux', initials: 'TL', gradient: 'from-yellow-900 to-amber-700', preview: 'Dubai is incredible at this time of year', time: '3 days ago', unread: 0, isOnline: false },
  { id: '8', username: 'Carlos_B', initials: 'CB2', gradient: 'from-indigo-900 to-purple-800', preview: 'Flamenco show on Friday, you\'re in?', time: '1 week ago', unread: 0, isOnline: false },
];

const MESSAGES = [
  { id: '1', sent: false, text: 'Hey! I noticed we have so many interests in common. The jazz bar you mentioned in your profile — I\'ve been there too! 😊', time: '2:15 PM' },
  { id: '2', sent: true, text: 'Oh wow, small world! Blue Note Soho right? It\'s one of my favourite spots in London. Do you go often?', time: '2:17 PM' },
  { id: '3', sent: false, text: 'Almost every other Thursday. They have this amazing quartet that plays Coltrane all night. The atmosphere is just unreal.', time: '2:20 PM' },
  { id: '4', sent: true, text: 'I absolutely love that! I was there last week actually for their special set. We might have been in the same room without knowing 😄', time: '2:22 PM' },
  { id: '5', sent: false, text: 'That\'s wild! We should coordinate next time. They have a special night coming up next Friday — Miles Davis tribute. Are you interested?', time: '2:25 PM' },
  { id: '6', sent: true, text: 'That sounds wonderful! I\'d love to. Shall we meet there or would you like to grab dinner first?', time: '2:28 PM' },
  { id: '7', sent: false, text: 'Dinner first sounds perfect. I know a lovely little French bistro nearby. Very Velour 😉', time: '2:30 PM', typing: false },
];

export default function MessagesPage() {
  const [activeConv, setActiveConv] = useState(CONVERSATIONS[0]);
  const [message, setMessage] = useState('');
  const [searchConv, setSearchConv] = useState('');

  const filteredConvs = CONVERSATIONS.filter((c) =>
    c.username.toLowerCase().includes(searchConv.toLowerCase())
  );

  function handleSend() {
    if (!message.trim()) return;
    setMessage('');
  }

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
            {filteredConvs.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConv(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-left border-b border-white/5 ${activeConv.id === conv.id ? 'bg-white/5 border-l-2 border-l-crimson-500' : ''}`}
                aria-label={`Conversation with ${conv.username}`}
              >
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${conv.gradient} flex items-center justify-center`}>
                    <span className="text-white text-sm font-bold">{conv.initials}</span>
                  </div>
                  {conv.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 border-2 border-[#0A0A0F] rounded-full" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-white font-medium text-sm truncate">{conv.username}</span>
                    <span className="text-white/30 text-xs flex-shrink-0 ml-2">{conv.time}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-white/50 text-xs truncate">{conv.preview}</p>
                    {conv.unread > 0 && (
                      <span className="flex-shrink-0 ml-2 min-w-5 h-5 bg-crimson-500 rounded-full text-white text-xs font-bold flex items-center justify-center px-1">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Conversation Window */}
        <div className="hidden md:flex flex-1 flex-col min-w-0">
          {/* Header */}
          <div className="glass-dark border-b border-white/5 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${activeConv.gradient} flex items-center justify-center`}>
                  <span className="text-white text-sm font-bold">{activeConv.initials}</span>
                </div>
                {activeConv.isOnline && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#0A0A0F] rounded-full" />
                )}
              </div>
              <div>
                <div className="text-white font-semibold text-sm">{activeConv.username}</div>
                <div className="text-xs flex items-center gap-1">
                  {activeConv.isOnline ? (
                    <>
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                      <span className="text-emerald-400">Online now</span>
                    </>
                  ) : (
                    <span className="text-white/40">Last seen 3h ago</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="w-8 h-8 glass rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-colors" aria-label="Voice call">
                <Phone size={14} />
              </button>
              <button className="w-8 h-8 glass rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-colors" aria-label="Video call">
                <Video size={14} />
              </button>
              <button className="w-8 h-8 glass rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-colors" aria-label="Profile link">
                <MapPin size={14} />
              </button>
              <button className="w-8 h-8 glass rounded-lg flex items-center justify-center text-white/50 hover:text-white transition-colors" aria-label="More options">
                <MoreVertical size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {MESSAGES.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sent ? 'justify-end' : 'justify-start'}`}>
                {!msg.sent && (
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${activeConv.gradient} flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1`}>
                    {activeConv.initials}
                  </div>
                )}
                <div className={`max-w-[70%] ${msg.sent ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.sent
                        ? 'bg-crimson-600 text-white rounded-tr-sm'
                        : 'glass text-white/90 rounded-tl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-white/30 text-xs px-1">{msg.time}</span>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {activeConv.isOnline && (
              <div className="flex justify-start">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${activeConv.gradient} flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0`}>
                  {activeConv.initials}
                </div>
                <div className="glass px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 bg-white/40 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="glass-dark border-t border-white/5 px-4 py-4">
            <div className="flex items-end gap-3">
              <button className="text-white/40 hover:text-white/70 transition-colors p-1" aria-label="Attach file">
                <Paperclip size={18} />
              </button>
              <div className="flex-1 relative">
                <textarea
                  placeholder={`Message ${activeConv.username}...`}
                  className="input-dark w-full px-4 py-3 pr-10 rounded-xl text-sm resize-none min-h-[44px] max-h-32"
                  rows={1}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  aria-label="Type a message"
                />
              </div>
              <button className="text-white/40 hover:text-white/70 transition-colors p-1" aria-label="Emoji">
                <Smile size={18} />
              </button>
              <button
                onClick={handleSend}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  message.trim() ? 'bg-crimson-500 hover:bg-crimson-400 glow-crimson' : 'glass text-white/30 cursor-not-allowed'
                }`}
                disabled={!message.trim()}
                aria-label="Send message"
              >
                <Send size={16} className="text-white" />
              </button>
            </div>
            <p className="text-white/20 text-xs mt-2 text-center">Messages are end-to-end encrypted</p>
          </div>
        </div>

        {/* Mobile: no conversation selected */}
        <div className="md:hidden flex-1 flex items-center justify-center">
          <p className="text-white/30 text-sm">Select a conversation</p>
        </div>
      </main>
    </div>
  );
}
