'use client';

import { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronLeft, Clock, MessageSquare, Lock, Send } from 'lucide-react';

interface Post {
  id: string;
  content: string;
  authorName?: string;
  authorAvatar?: string;
  createdAt?: string;
  isOP?: boolean;
}

interface Thread {
  id: string;
  title: string;
  forumSlug?: string;
  forumName?: string;
  posts?: Post[];
  replyCount?: number;
  views?: number;
  authorName?: string;
  createdAt?: string;
}

function formatTime(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function AuthorAvatar({ name, size = 10 }: { name?: string; size?: number }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const colors = ['from-rose-900 to-red-700', 'from-violet-900 to-purple-700', 'from-emerald-900 to-teal-700', 'from-blue-900 to-cyan-800'];
  const color = colors[(initials.charCodeAt(0) || 0) % colors.length];
  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const userTier = (session?.user as { membershipTier?: string } | undefined)?.membershipTier || 'FREE';
  const canReply = status === 'authenticated' && (userTier === 'GOLD' || userTier === 'PLATINUM');

  useEffect(() => {
    params.then(({ id }) => setThreadId(id));
  }, [params]);

  useEffect(() => {
    if (!threadId) return;
    setLoading(true);
    fetch(`/api/forums/threads/${threadId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setThread(data))
      .finally(() => setLoading(false));
  }, [threadId]);

  async function handleReply() {
    if (!reply.trim() || !threadId || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/forums/threads/${threadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reply }),
      });
      if (res.ok) {
        const newPost = await res.json();
        setThread((t) => t ? { ...t, posts: [...(t.posts || []), newPost] } : t);
        setReply('');
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to post reply');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const posts = thread?.posts || [];

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        {/* Header */}
        <div className="bg-gradient-to-b from-[#0F0A1E] to-[#0A0A0F] py-10 px-4 border-b border-white/5">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 text-sm mb-4">
              <Link href="/forums" className="text-white/40 hover:text-white transition-colors">Forums</Link>
              {thread?.forumSlug && (
                <>
                  <span className="text-white/20">/</span>
                  <Link href={`/forums/${thread.forumSlug}`} className="text-white/40 hover:text-white transition-colors">
                    {thread.forumName || thread.forumSlug}
                  </Link>
                </>
              )}
            </div>
            <Link href={thread?.forumSlug ? `/forums/${thread.forumSlug}` : '/forums'} className="flex items-center gap-1 text-white/40 hover:text-white text-sm mb-3 transition-colors">
              <ChevronLeft size={14} />Back
            </Link>
            {loading ? (
              <div className="h-8 w-64 bg-white/5 rounded animate-pulse" />
            ) : (
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-white">{thread?.title || 'Thread'}</h1>
            )}
            {thread && (
              <div className="flex items-center gap-4 mt-2 text-white/40 text-xs">
                {thread.authorName && <span>by <span className="text-white/60">{thread.authorName}</span></span>}
                {thread.createdAt && <span className="flex items-center gap-1"><Clock size={10} />{formatTime(thread.createdAt)}</span>}
                <span className="flex items-center gap-1"><MessageSquare size={10} />{thread.replyCount ?? posts.length - 1} replies</span>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass rounded-2xl p-6 animate-pulse">
                  <div className="h-4 bg-white/5 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-white/5 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post, idx) => (
                <div key={post.id} className={`glass rounded-2xl p-6 ${post.isOP || idx === 0 ? 'border border-[#DC143C]/20' : ''}`}>
                  <div className="flex items-start gap-4">
                    <AuthorAvatar name={post.authorName} size={10} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="text-white font-semibold text-sm">{post.authorName || 'Anonymous'}</span>
                        {(post.isOP || idx === 0) && (
                          <span className="bg-[#DC143C]/20 text-[#DC143C] text-xs px-2 py-0.5 rounded-full font-semibold">OP</span>
                        )}
                        {post.createdAt && (
                          <span className="text-white/30 text-xs">{formatTime(post.createdAt)}</span>
                        )}
                      </div>
                      <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}

          {/* Reply Form */}
          <div className="mt-8 glass rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <MessageSquare size={16} className="text-[#DC143C]" />
              Post a Reply
            </h3>

            {status === 'unauthenticated' ? (
              <div className="text-center py-4">
                <p className="text-white/50 text-sm mb-3">Sign in to join the discussion</p>
                <Link href="/auth/signin" className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] text-white px-6 py-2.5 rounded-xl text-sm font-semibold">
                  Sign In
                </Link>
              </div>
            ) : !canReply ? (
              <div className="flex items-center gap-3 glass rounded-xl p-4 border border-[#D4AF37]/20">
                <Lock size={20} className="text-[#D4AF37] flex-shrink-0" />
                <div>
                  <p className="text-white font-medium text-sm">Gold Membership Required</p>
                  <p className="text-white/50 text-xs mt-0.5">Upgrade to Gold or Platinum to post replies in forums.</p>
                </div>
                <Link href="/upgrade" className="ml-auto bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] font-bold px-4 py-2 rounded-lg text-xs whitespace-nowrap">
                  Upgrade
                </Link>
              </div>
            ) : (
              <>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="input-dark w-full px-4 py-3 rounded-xl text-sm resize-none mb-3"
                  rows={4}
                  aria-label="Reply content"
                />
                {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
                <div className="flex justify-end">
                  <button
                    onClick={handleReply}
                    disabled={!reply.trim() || submitting}
                    className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-6 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={14} />}
                    {submitting ? 'Posting...' : 'Post Reply'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
