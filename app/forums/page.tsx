import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { MessageSquare, Users, TrendingUp, Clock, Eye, Flame, Plus, Crown } from 'lucide-react';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { isPaid } from '@/lib/premium';

interface ForumCategory {
  id: string;
  slug: string;
  name: string;
  description?: string;
  threadCount?: number;
  postCount?: number;
  latestThread?: { title: string; authorName: string; createdAt: string };
  icon?: string;
  color?: string;
}

async function getForums(): Promise<ForumCategory[]> {
  try {
    // Query the DB directly: a server-side fetch to our own API carries no
    // session cookie, so the auth-protected route would always 401.
    const rows = await db.forumCategory.findMany({
      include: {
        _count: { select: { threads: true } },
        threads: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            title: true,
            createdAt: true,
            author: { select: { username: true, profile: { select: { displayName: true } } } },
          },
        },
      },
      orderBy: { order: 'asc' },
    });
    const postCounts = await db.forumPost.groupBy({
      by: ['threadId'],
      _count: { _all: true },
      where: { thread: { categoryId: { in: rows.map((r) => r.id) } } },
    });
    const threadCategory = new Map(
      (await db.forumThread.findMany({
        where: { categoryId: { in: rows.map((r) => r.id) } },
        select: { id: true, categoryId: true },
      })).map((t) => [t.id, t.categoryId])
    );
    const postsByCategory = new Map<string, number>();
    for (const pc of postCounts) {
      const cat = threadCategory.get(pc.threadId);
      if (cat) postsByCategory.set(cat, (postsByCategory.get(cat) ?? 0) + pc._count._all);
    }
    return rows.map((r) => {
      const latest = r.threads[0];
      return {
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description ?? undefined,
        icon: r.icon ?? undefined,
        threadCount: r._count.threads,
        postCount: postsByCategory.get(r.id) ?? 0,
        latestThread: latest
          ? {
              title: latest.title,
              authorName: latest.author.profile?.displayName || latest.author.username,
              createdAt: latest.createdAt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }),
            }
          : undefined,
      };
    });
  } catch {
    return [];
  }
}

const ICON_MAP: Record<string, React.ElementType> = {
  MessageSquare,
  Flame,
  Users,
  TrendingUp,
};

const COLOR_MAP: Record<string, { text: string; bg: string }> = {
  blue: { text: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
  crimson: { text: 'text-[#DC143C]', bg: 'bg-[#DC143C]/10 border-[#DC143C]/20' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  gold: { text: 'text-[#D4AF37]', bg: 'bg-[#D4AF37]/10 border-[#D4AF37]/20' },
  purple: { text: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20' },
};

export default async function ForumsPage() {
  const [categories, session] = await Promise.all([getForums(), auth()]);
  const userId = session?.user?.id;
  let canPost = false;
  if (userId) {
    const u = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, profile: { select: { membershipTier: true } } },
    });
    canPost = isPaid(u?.profile?.membershipTier, u?.role);
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        {/* Header */}
        <div className="bg-gradient-to-b from-[#0F0A1E] to-[#0A0A0F] py-12 px-4 border-b border-white/5">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="font-serif text-4xl font-bold text-white mb-2">Community Forums</h1>
              <p className="text-white/50">Connect, share, and engage with the Hush community</p>
            </div>
            {canPost ? (
              categories.length > 0 && (
                <Link
                  href={`/forums/${categories[0].slug}`}
                  className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm transition-all"
                >
                  <Plus size={16} />
                  Start Discussion
                </Link>
              )
            ) : (
              <Link
                href="/upgrade"
                className="bg-gradient-to-r from-[#D4AF37] to-[#B8960C] text-[#0A0A0F] px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm transition-all"
              >
                <Crown size={16} />
                Upgrade to post
              </Link>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="border-b border-white/5 bg-[#060609]">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap gap-6">
            {[
              { icon: Users, label: 'Members online', color: 'text-emerald-400' },
              { icon: MessageSquare, label: 'Posts today', color: 'text-blue-400' },
              { icon: TrendingUp, label: 'Threads total', color: 'text-[#D4AF37]' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                <Icon size={14} className={color} />
                <span className="text-white/50">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-10">
          {/* Forum Categories */}
          {categories.length === 0 ? (
            <div className="text-center py-20">
              <MessageSquare size={48} className="text-white/10 mx-auto mb-4" />
              <p className="text-white/30 text-lg">No forum categories yet</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              {categories.map((cat, idx) => {
                const colorKey = cat.color || ['blue', 'crimson', 'emerald', 'gold'][idx % 4];
                const colors = COLOR_MAP[colorKey] || COLOR_MAP.blue;
                const Icon = (cat.icon && ICON_MAP[cat.icon]) || MessageSquare;

                return (
                  <Link
                    key={cat.id}
                    href={`/forums/${cat.slug}`}
                    className="glass rounded-2xl p-6 hover:border-white/20 transition-all group cursor-pointer block"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl border ${colors.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                        <Icon className={colors.text} size={22} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className={`text-white font-bold text-lg mb-1 group-hover:${colors.text} transition-colors`}>{cat.name}</h3>
                        {cat.description && (
                          <p className="text-white/50 text-sm leading-relaxed mb-4">{cat.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-white/40 mb-4">
                          <span className="flex items-center gap-1">
                            <MessageSquare size={10} />
                            {(cat.threadCount ?? 0).toLocaleString()} threads
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye size={10} />
                            {(cat.postCount ?? 0).toLocaleString()} posts
                          </span>
                        </div>

                        {cat.latestThread && (
                          <div className="glass-dark rounded-lg px-3 py-2">
                            <p className="text-white/30 text-xs mb-0.5">Latest:</p>
                            <p className="text-white/70 text-xs truncate">&ldquo;{cat.latestThread.title}&rdquo;</p>
                            <p className="text-white/30 text-xs flex items-center gap-1">
                              <span>by {cat.latestThread.authorName}</span>
                              <Clock size={9} />
                              <span>{cat.latestThread.createdAt}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
