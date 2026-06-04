import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { MessageSquare, Users, TrendingUp, Clock, Eye, Flame, Plus } from 'lucide-react';

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

async function getForums() {
  try {
    const res = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/forums`,
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.categories || data || [];
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
  const categories: ForumCategory[] = await getForums();

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        {/* Header */}
        <div className="bg-gradient-to-b from-[#0F0A1E] to-[#0A0A0F] py-12 px-4 border-b border-white/5">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="font-serif text-4xl font-bold text-white mb-2">Community Forums</h1>
              <p className="text-white/50">Connect, share, and engage with the Velour community</p>
            </div>
            <Link
              href="/forums/new"
              className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm transition-all"
            >
              <Plus size={16} />
              Start Discussion
            </Link>
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
