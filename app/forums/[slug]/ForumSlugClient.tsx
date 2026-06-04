'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, Eye, Clock, ChevronLeft, ChevronRight, Plus, X, Lock, Pin } from 'lucide-react';

interface Thread {
  id: string;
  title: string;
  authorName?: string;
  authorAvatar?: string;
  replyCount?: number;
  views?: number;
  lastReplyAt?: string;
  createdAt?: string;
  isPinned?: boolean;
}

interface ForumCategory {
  id: string;
  slug: string;
  name: string;
  description?: string;
  threadCount?: number;
}

interface Props {
  slug: string;
  category: ForumCategory | null;
  threads: Thread[];
  total: number;
  currentPage: number;
  canPost: boolean;
}

function formatTime(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

export default function ForumSlugClient({ slug, category, threads, total, currentPage, canPost }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [showNewThread, setShowNewThread] = useState(false);
  const [threadTitle, setThreadTitle] = useState('');
  const [threadContent, setThreadContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const totalPages = Math.max(1, Math.ceil(total / 20));

  function goToPage(p: number) {
    const params = new URLSearchParams();
    params.set('page', String(p));
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleSubmitThread() {
    if (!threadTitle.trim() || !threadContent.trim()) {
      setError('Title and content are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/forums/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: threadTitle, content: threadContent }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowNewThread(false);
        setThreadTitle('');
        setThreadContent('');
        if (data.id) router.push(`/forums/threads/${data.id}`);
        else router.refresh();
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to create thread');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-b from-[#0F0A1E] to-[#0A0A0F] py-12 px-4 border-b border-white/5">
        <div className="max-w-4xl mx-auto">
          <Link href="/forums" className="flex items-center gap-1 text-white/40 hover:text-white text-sm mb-4 transition-colors">
            <ChevronLeft size={14} />
            Back to Forums
          </Link>
          <h1 className="font-serif text-3xl font-bold text-white mb-2">{category?.name || slug}</h1>
          {category?.description && <p className="text-white/50">{category.description}</p>}
          <p className="text-white/30 text-sm mt-2">{total} threads</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-white/40 text-sm">Showing page {currentPage} of {totalPages}</p>
          {canPost ? (
            <button
              onClick={() => setShowNewThread(true)}
              className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-5 py-2 rounded-xl font-semibold flex items-center gap-2 text-sm transition-all"
            >
              <Plus size={16} />
              New Thread
            </button>
          ) : (
            <div className="flex items-center gap-2 glass px-4 py-2 rounded-xl text-[#D4AF37] text-sm">
              <Lock size={14} />
              <span>Gold+ required to post</span>
            </div>
          )}
        </div>

        {/* Thread List */}
        {threads.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare size={48} className="text-white/10 mx-auto mb-4" />
            <p className="text-white/30 text-lg">No threads yet</p>
            {canPost && (
              <button onClick={() => setShowNewThread(true)} className="mt-4 text-[#DC143C] hover:text-[#FF1744] text-sm transition-colors">
                Start the first discussion
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 mb-8">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                href={`/forums/threads/${thread.id}`}
                className="block glass rounded-xl px-5 py-4 hover:border-white/20 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {thread.isPinned && (
                        <span className="flex items-center gap-1 bg-[#D4AF37]/20 text-[#D4AF37] text-xs px-2 py-0.5 rounded-full font-semibold">
                          <Pin size={9} />Pinned
                        </span>
                      )}
                    </div>
                    <h4 className="text-white/90 font-medium group-hover:text-white transition-colors">{thread.title}</h4>
                    <div className="flex items-center gap-3 mt-1 text-white/30 text-xs">
                      {thread.authorName && <span>by <span className="text-white/50">{thread.authorName}</span></span>}
                      {thread.createdAt && (
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatTime(thread.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                    <div className="text-center">
                      <div className="text-white/70 font-semibold">{thread.replyCount ?? 0}</div>
                      <div className="text-white/30 flex items-center gap-1"><MessageSquare size={9} />replies</div>
                    </div>
                    <div className="text-center">
                      <div className="text-white/70 font-semibold">{(thread.views ?? 0).toLocaleString()}</div>
                      <div className="text-white/30 flex items-center gap-1"><Eye size={9} />views</div>
                    </div>
                    {thread.lastReplyAt && (
                      <div className="text-center hidden sm:block">
                        <div className="text-white/30 text-xs">{formatTime(thread.lastReplyAt)}</div>
                        <div className="text-white/20 text-xs">last reply</div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}
              className="glass px-3 py-2 rounded-lg text-white/50 hover:text-white transition-colors disabled:opacity-30" aria-label="Previous page">
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => goToPage(p)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${p === currentPage ? 'bg-[#DC143C] text-white' : 'glass text-white/60 hover:text-white'}`}>
                {p}
              </button>
            ))}
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}
              className="glass px-3 py-2 rounded-lg text-white/50 hover:text-white transition-colors disabled:opacity-30" aria-label="Next page">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* New Thread Modal */}
      {showNewThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-lg">New Thread</h3>
              <button onClick={() => setShowNewThread(false)} className="text-white/40 hover:text-white transition-colors" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-white/60 text-xs uppercase tracking-widest block mb-2" htmlFor="thread-title">Title</label>
                <input
                  id="thread-title"
                  type="text"
                  value={threadTitle}
                  onChange={(e) => setThreadTitle(e.target.value)}
                  placeholder="What do you want to discuss?"
                  className="input-dark w-full px-4 py-3 rounded-xl text-sm"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="text-white/60 text-xs uppercase tracking-widest block mb-2" htmlFor="thread-content">Content</label>
                <textarea
                  id="thread-content"
                  value={threadContent}
                  onChange={(e) => setThreadContent(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="input-dark w-full px-4 py-3 rounded-xl text-sm resize-none"
                  rows={6}
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowNewThread(false)} className="flex-1 glass py-2.5 rounded-xl text-white/60 hover:text-white text-sm transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmitThread}
                disabled={submitting || !threadTitle.trim() || !threadContent.trim()}
                className="flex-1 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              >
                {submitting ? 'Posting...' : 'Post Thread'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
