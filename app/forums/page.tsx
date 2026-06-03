import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { MessageSquare, Users, TrendingUp, Clock, Eye, Plus, Flame } from 'lucide-react';

const CATEGORIES = [
  {
    id: 1,
    icon: MessageSquare,
    title: 'General Chat',
    description: 'Casual conversation, introductions, and getting to know the community. A welcoming space for everyone.',
    threads: 1284,
    posts: 18492,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10 border-blue-400/20',
    latest: { author: 'Sofia_M', time: '5 min ago', title: 'Favourite hidden restaurants in London?' },
  },
  {
    id: 2,
    icon: Flame,
    title: 'Lifestyle & Stories',
    description: 'Share your experiences, adventures, and stories. This is where real connections begin with honesty.',
    threads: 892,
    posts: 12384,
    color: 'text-crimson-400',
    bg: 'bg-crimson-400/10 border-crimson-400/20',
    latest: { author: 'MaxVan', time: '23 min ago', title: 'Amsterdam cycling trip — meet ups?' },
  },
  {
    id: 3,
    icon: Users,
    title: 'Advice & Support',
    description: 'Get relationship advice, share experiences, and support each other through life\'s complexities.',
    threads: 567,
    posts: 9123,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10 border-emerald-400/20',
    latest: { author: 'LilyRose', time: '1h ago', title: 'Long distance — how do you make it work?' },
  },
  {
    id: 4,
    icon: TrendingUp,
    title: 'Events & Meetups',
    description: 'Organise and discuss upcoming Velour events, local meetups, and social gatherings worldwide.',
    threads: 341,
    posts: 5678,
    color: 'text-gold-400',
    bg: 'bg-gold-400/10 border-gold-400/20',
    latest: { author: 'TomLux', time: '2h ago', title: 'Dubai New Year — who\'s coming?' },
  },
];

const HOT_THREADS = [
  { id: 1, title: 'Best first date ideas in London — your top picks?', author: 'JakeMcK', replies: 47, views: 1283, time: '1h ago', category: 'General Chat', hot: true },
  { id: 2, title: 'How Velour changed my approach to dating entirely', author: 'AnnaParis', replies: 89, views: 3421, time: '3h ago', category: 'Lifestyle & Stories', hot: true },
  { id: 3, title: 'Navigating open relationships — communication tips', author: 'Sofia_M', replies: 62, views: 2109, time: '5h ago', category: 'Advice & Support', hot: false },
  { id: 4, title: 'Paris December meetup planning thread', author: 'Carlos_B', replies: 23, views: 876, time: '6h ago', category: 'Events & Meetups', hot: false },
  { id: 5, title: 'Profile photo tips that actually work', author: 'LilyRose', replies: 34, views: 1567, time: '8h ago', category: 'General Chat', hot: true },
  { id: 6, title: 'Velour Gold worth it? Honest reviews here', author: 'IrinaK', replies: 118, views: 4892, time: '12h ago', category: 'General Chat', hot: true },
];

const CATEGORY_BADGE: Record<string, string> = {
  'General Chat': 'bg-blue-500/20 text-blue-400',
  'Lifestyle & Stories': 'bg-crimson-500/20 text-crimson-400',
  'Advice & Support': 'bg-emerald-500/20 text-emerald-400',
  'Events & Meetups': 'bg-gold-500/20 text-gold-400',
};

export default function ForumsPage() {
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
            <button className="btn-crimson px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm">
              <Plus size={16} />
              Start New Thread
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="border-b border-white/5 bg-[#060609]">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap gap-6">
            {[
              { icon: Users, label: '3,847 members online', color: 'text-emerald-400' },
              { icon: MessageSquare, label: '284 posts today', color: 'text-blue-400' },
              { icon: TrendingUp, label: '3,084 threads total', color: 'text-gold-400' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-2 text-sm">
                <Icon size={14} className={color} />
                <span className="text-white/50">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-10">
          {/* Categories Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.id} className="glass rounded-2xl p-6 card-hover cursor-pointer group">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl border ${cat.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                      <Icon className={cat.color} size={22} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold text-lg mb-1 group-hover:text-crimson-400 transition-colors">{cat.title}</h3>
                      <p className="text-white/50 text-sm leading-relaxed mb-4">{cat.description}</p>

                      <div className="flex items-center gap-4 text-xs text-white/40 mb-4">
                        <span className="flex items-center gap-1"><MessageSquare size={10} />{cat.threads.toLocaleString()} threads</span>
                        <span className="flex items-center gap-1"><Eye size={10} />{cat.posts.toLocaleString()} posts</span>
                      </div>

                      <div className="glass-dark rounded-lg px-3 py-2">
                        <p className="text-white/30 text-xs mb-0.5">Latest:</p>
                        <p className="text-white/70 text-xs truncate">&ldquo;{cat.latest.title}&rdquo;</p>
                        <p className="text-white/30 text-xs">by {cat.latest.author} · {cat.latest.time}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hot Threads */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Flame className="text-crimson-500" size={20} />
              <h2 className="font-serif text-2xl font-bold text-white">Hot Threads</h2>
            </div>

            <div className="space-y-2">
              {HOT_THREADS.map((thread) => (
                <div key={thread.id} className="glass rounded-xl px-5 py-4 hover:border-white/20 transition-all cursor-pointer group">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {thread.hot && (
                          <span className="flex items-center gap-1 bg-crimson-500/20 text-crimson-400 text-xs px-2 py-0.5 rounded-full font-semibold">
                            <Flame size={10} />Hot
                          </span>
                        )}
                        <span className={`${CATEGORY_BADGE[thread.category] || 'bg-white/10 text-white/50'} text-xs px-2 py-0.5 rounded-full`}>
                          {thread.category}
                        </span>
                      </div>
                      <h4 className="text-white/90 font-medium text-sm group-hover:text-white transition-colors truncate">{thread.title}</h4>
                      <div className="flex items-center gap-3 mt-1 text-white/30 text-xs">
                        <span>by <span className="text-white/50">{thread.author}</span></span>
                        <span className="flex items-center gap-1"><Clock size={10} />{thread.time}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0 text-xs">
                      <div className="text-center">
                        <div className="text-white/70 font-semibold">{thread.replies}</div>
                        <div className="text-white/30">replies</div>
                      </div>
                      <div className="text-center">
                        <div className="text-white/70 font-semibold">{thread.views.toLocaleString()}</div>
                        <div className="text-white/30">views</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-8">
              <button className="glass border border-white/20 hover:border-white/40 px-6 py-2.5 rounded-xl text-white/70 hover:text-white text-sm font-medium transition-all">
                View All Threads
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
