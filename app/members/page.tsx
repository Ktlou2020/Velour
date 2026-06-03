import Navbar from '@/components/Navbar';
import MemberCard from '@/components/MemberCard';
import Footer from '@/components/Footer';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';

const MEMBERS = [
  { username: 'Sofia_M', age: 28, location: 'London, UK', isOnline: true, interests: ['Travel', 'Wine', 'Art'], membershipTier: 'GOLD' as const },
  { username: 'JakeMcK', age: 34, location: 'New York, US', isOnline: false, interests: ['Fitness', 'Jazz', 'Cooking'], membershipTier: 'PLATINUM' as const },
  { username: 'AnnaParis', age: 26, location: 'Paris, FR', isOnline: true, interests: ['Fashion', 'Photography', 'Dance'], membershipTier: 'FREE' as const },
  { username: 'Carlos_B', age: 31, location: 'Madrid, ES', isOnline: false, interests: ['Music', 'Sailing', 'Cinema'], membershipTier: 'GOLD' as const },
  { username: 'LilyRose', age: 29, location: 'Sydney, AU', isOnline: true, interests: ['Yoga', 'Hiking', 'Reading'], membershipTier: 'FREE' as const },
  { username: 'MaxVan', age: 36, location: 'Amsterdam, NL', isOnline: true, interests: ['Cycling', 'Architecture', 'Wine'], membershipTier: 'PLATINUM' as const },
  { username: 'IrinaK', age: 27, location: 'Moscow, RU', isOnline: false, interests: ['Ballet', 'Literature', 'Skiing'], membershipTier: 'GOLD' as const },
  { username: 'TomLux', age: 33, location: 'Dubai, UAE', isOnline: true, interests: ['Business', 'Golf', 'Travel'], membershipTier: 'PLATINUM' as const },
  { username: 'ElenaMad', age: 30, location: 'Madrid, ES', isOnline: false, interests: ['Flamenco', 'Food', 'Art'], membershipTier: 'FREE' as const },
  { username: 'RyanDub', age: 32, location: 'Dublin, IE', isOnline: true, interests: ['Rugby', 'Comedy', 'Whiskey'], membershipTier: 'GOLD' as const },
  { username: 'ChantalB', age: 25, location: 'Brussels, BE', isOnline: true, interests: ['Chocolate', 'Fashion', 'Travel'], membershipTier: 'FREE' as const },
  { username: 'MarcoBCN', age: 38, location: 'Barcelona, ES', isOnline: false, interests: ['Architecture', 'Tapas', 'Art'], membershipTier: 'PLATINUM' as const },
];

export default function MembersPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />

      <main className="pt-16">
        {/* Header */}
        <div className="bg-gradient-to-b from-[#0F0A1E] to-[#0A0A0F] py-12 px-4 border-b border-white/5">
          <div className="max-w-7xl mx-auto">
            <h1 className="font-serif text-4xl font-bold text-white mb-2">Browse Members</h1>
            <p className="text-white/50">Discover extraordinary people from around the world</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full online-pulse" />
              <span className="text-emerald-400 text-sm font-medium">3,847 members online now</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Search + Sort Bar */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
              <input
                type="search"
                placeholder="Search by username, location..."
                className="input-dark w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                aria-label="Search members"
              />
            </div>
            <select className="input-dark px-4 py-3 rounded-xl text-sm bg-[#0A0A0F] text-white/70" aria-label="Sort members">
              <option value="newest">Newest Members</option>
              <option value="active">Most Active</option>
              <option value="closest">Closest</option>
              <option value="match">Best Match</option>
            </select>
            <button className="flex items-center gap-2 glass px-4 py-3 rounded-xl text-white/70 hover:text-white text-sm transition-colors" aria-label="Open filters">
              <SlidersHorizontal size={16} />
              Filters
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar Filters */}
            <aside className="lg:w-64 flex-shrink-0" aria-label="Filter sidebar">
              <div className="glass rounded-2xl p-6 sticky top-20">
                <h2 className="text-white font-semibold mb-6 flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-crimson-500" />
                  Filters
                </h2>

                {/* Age Range */}
                <div className="mb-6">
                  <label className="text-white/60 text-xs uppercase tracking-widest mb-3 block">Age Range</label>
                  <div className="flex items-center gap-3">
                    <input type="number" min={18} max={99} defaultValue={18} className="input-dark w-20 px-3 py-2 rounded-lg text-sm text-center" aria-label="Minimum age" />
                    <span className="text-white/30">—</span>
                    <input type="number" min={18} max={99} defaultValue={65} className="input-dark w-20 px-3 py-2 rounded-lg text-sm text-center" aria-label="Maximum age" />
                  </div>
                </div>

                {/* Location */}
                <div className="mb-6">
                  <label className="text-white/60 text-xs uppercase tracking-widest mb-3 block" htmlFor="location-filter">Location</label>
                  <input id="location-filter" type="text" placeholder="City or country" className="input-dark w-full px-3 py-2 rounded-lg text-sm" />
                </div>

                {/* Relationship Type */}
                <div className="mb-6">
                  <label className="text-white/60 text-xs uppercase tracking-widest mb-3 block">Relationship Type</label>
                  {['Single', 'Couple seeking man', 'Couple seeking woman', 'Couple seeking couple', 'Poly / Open', 'Everyone'].map((type) => (
                    <label key={type} className="flex items-center gap-2 py-1.5 cursor-pointer group">
                      <input type="checkbox" defaultChecked className="rounded border-white/20 bg-white/5 text-crimson-500 focus:ring-crimson-500 focus:ring-offset-0" />
                      <span className="text-white/60 text-sm group-hover:text-white transition-colors">{type}</span>
                    </label>
                  ))}
                </div>

                {/* Orientation */}
                <div className="mb-6">
                  <label className="text-white/60 text-xs uppercase tracking-widest mb-3 block">Orientation</label>
                  {['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual'].map((o) => (
                    <label key={o} className="flex items-center gap-2 py-1.5 cursor-pointer group">
                      <input type="checkbox" defaultChecked className="rounded border-white/20 bg-white/5 text-crimson-500 focus:ring-crimson-500 focus:ring-offset-0" />
                      <span className="text-white/60 text-sm group-hover:text-white transition-colors">{o}</span>
                    </label>
                  ))}
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-white/60 text-sm">Online now</span>
                    <div className="relative">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-10 h-5 bg-white/10 rounded-full peer peer-checked:bg-crimson-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-5" />
                    </div>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-white/60 text-sm">With photos</span>
                    <div className="relative">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-10 h-5 bg-white/10 rounded-full peer peer-checked:bg-crimson-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-5" />
                    </div>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-white/60 text-sm">Verified only</span>
                    <div className="relative">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-10 h-5 bg-white/10 rounded-full peer peer-checked:bg-crimson-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-5" />
                    </div>
                  </label>
                </div>

                <button className="w-full btn-crimson py-2.5 rounded-xl text-sm font-semibold mt-6">
                  Apply Filters
                </button>
              </div>
            </aside>

            {/* Member Grid */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <p className="text-white/50 text-sm">Showing <span className="text-white">12</span> of <span className="text-white">52,847</span> members</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {MEMBERS.map((member) => (
                  <MemberCard key={member.username} {...member} />
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-center gap-2 mt-10">
                <button className="glass px-3 py-2 rounded-lg text-white/50 hover:text-white transition-colors" aria-label="Previous page">
                  <ChevronLeft size={16} />
                </button>
                {[1, 2, 3, 4, 5].map((p) => (
                  <button
                    key={p}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${p === 1 ? 'bg-crimson-500 text-white' : 'glass text-white/60 hover:text-white'}`}
                    aria-label={`Page ${p}`}
                    aria-current={p === 1 ? 'page' : undefined}
                  >
                    {p}
                  </button>
                ))}
                <span className="text-white/30 text-sm">...</span>
                <button className="w-9 h-9 rounded-lg glass text-white/60 hover:text-white text-sm transition-all" aria-label="Page 1174">1174</button>
                <button className="glass px-3 py-2 rounded-lg text-white/50 hover:text-white transition-colors" aria-label="Next page">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
