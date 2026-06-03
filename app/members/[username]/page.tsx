import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MemberCard from '@/components/MemberCard';
import { MapPin, Shield, Eye, Heart, MessageCircle, Flag, Crown, Star, Camera } from 'lucide-react';

const INTERESTS = [
  'Travel', 'Fine Dining', 'Wine', 'Jazz', 'Photography', 'Fitness',
  'Art Galleries', 'Sailing', 'Skiing', 'Theatre', 'Literature', 'Yoga',
  'Cooking', 'Dancing', 'Architecture', 'Cinema', 'Fashion', 'Hiking',
  'Music', 'Meditation',
];

const ALSO_VIEWED = [
  { username: 'JakeMcK', age: 34, location: 'New York', isOnline: false, membershipTier: 'PLATINUM' as const },
  { username: 'MaxVan', age: 36, location: 'Amsterdam', isOnline: true, membershipTier: 'GOLD' as const },
  { username: 'Carlos_B', age: 31, location: 'Madrid', isOnline: false, membershipTier: 'FREE' as const },
  { username: 'TomLux', age: 33, location: 'Dubai', isOnline: true, membershipTier: 'PLATINUM' as const },
];

const PHOTO_GRADIENTS = [
  'from-rose-900 to-red-800',
  'from-indigo-900 to-purple-800',
  'from-emerald-900 to-teal-700',
  'from-amber-900 to-orange-800',
  'from-pink-900 to-rose-700',
  'from-blue-900 to-cyan-800',
];

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function MemberProfilePage({ params }: PageProps) {
  const { username } = await params;
  const displayName = username.replace(/_/g, ' ');
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />

      <main className="pt-16">
        {/* Hero */}
        <div className="relative bg-gradient-to-b from-[#1A0007] to-[#0A0A0F] pt-12 pb-0 overflow-hidden">
          <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(220,20,60,0.3) 0%, transparent 70%)' }} />

          <div className="max-w-5xl mx-auto px-4">
            <div className="flex flex-col md:flex-row items-start gap-8 pb-8">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-36 h-36 md:w-48 md:h-48 rounded-2xl bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center glow-crimson">
                  <span className="text-white text-5xl md:text-6xl font-bold font-serif">{initials}</span>
                </div>
                <div className="absolute -bottom-2 -right-2 flex items-center gap-1.5 bg-emerald-500 px-2 py-1 rounded-full">
                  <div className="w-2 h-2 bg-white rounded-full" />
                  <span className="text-white text-xs font-semibold">Online</span>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex flex-wrap items-start gap-3 mb-3">
                  <h1 className="font-serif text-3xl md:text-4xl font-bold text-white">{displayName}</h1>
                  <div className="flex items-center gap-1 bg-gold-600/20 border border-gold-500/30 px-3 py-1 rounded-full">
                    <Star size={12} className="text-gold-400" />
                    <span className="text-gold-400 text-xs font-bold">Gold Member</span>
                  </div>
                  <div className="flex items-center gap-1 glass px-3 py-1 rounded-full">
                    <Shield size={12} className="text-emerald-400" />
                    <span className="text-emerald-400 text-xs font-semibold">Verified</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-white/60 text-sm mb-4">
                  <span className="flex items-center gap-1"><MapPin size={14} /> London, UK</span>
                  <span>28 years old</span>
                  <span>Member since Jan 2024</span>
                </div>

                <p className="text-white/70 text-sm leading-relaxed max-w-lg mb-6">
                  I&apos;m a passionate traveller and art lover who believes life is too short for ordinary. Looking for someone who appreciates fine dining, spontaneous adventures, and deep conversations. Let&apos;s see where this goes.
                </p>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <button className="btn-crimson px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 text-sm">
                    <MessageCircle size={16} />
                    Send Message
                  </button>
                  <button className="glass border border-white/20 hover:border-crimson-500/40 px-5 py-2.5 rounded-xl text-white text-sm font-medium flex items-center gap-2 transition-all">
                    <Heart size={16} className="text-crimson-400" />
                    Like
                  </button>
                  <button className="glass border border-white/20 hover:border-gold-500/40 px-5 py-2.5 rounded-xl text-white text-sm font-medium flex items-center gap-2 transition-all">
                    👋 Wink
                  </button>
                  <button className="glass px-3 py-2.5 rounded-xl text-white/40 hover:text-crimson-400 text-sm transition-all" aria-label="Report member">
                    <Flag size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-3 border-t border-white/5 py-4">
              {[
                { icon: Eye, label: 'Profile Views', value: '1,247' },
                { icon: Heart, label: 'Likes', value: '89' },
                { icon: Camera, label: 'Photos', value: '6' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Icon size={14} className="text-crimson-500" />
                    <span className="text-white font-bold">{value}</span>
                  </div>
                  <p className="text-white/40 text-xs">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 py-10 grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-8">
            {/* About Me */}
            <div className="glass rounded-2xl p-6">
              <h2 className="font-serif text-xl font-bold text-white mb-4">About Me</h2>
              <p className="text-white/70 leading-relaxed mb-3">
                By day I work in fashion consulting, by night I&apos;m exploring the city&apos;s hidden gems — the tiny jazz bar on Soho, the rooftop terrace in Notting Hill, the gallery opening in Mayfair. Life is too rich to spend it bored.
              </p>
              <p className="text-white/70 leading-relaxed">
                I love intelligent conversation, good wine, and spontaneous plans. I&apos;m equally comfortable at a black-tie dinner or a street market at 7am. Looking for someone equally adventurous and authentic.
              </p>
            </div>

            {/* Looking For */}
            <div className="glass rounded-2xl p-6">
              <h2 className="font-serif text-xl font-bold text-white mb-4">Looking For</h2>
              <div className="flex flex-wrap gap-2">
                {['Long-term Relationship', 'Friendship', 'Activity Partner', 'Open to Anything'].map((tag) => (
                  <span key={tag} className="glass-crimson px-3 py-1.5 rounded-full text-crimson-400 text-sm border border-crimson-500/20">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Interests */}
            <div className="glass rounded-2xl p-6">
              <h2 className="font-serif text-xl font-bold text-white mb-4">Interests</h2>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((interest) => (
                  <span key={interest} className="glass px-3 py-1.5 rounded-full text-white/70 text-sm hover:text-white hover:border-crimson-500/30 transition-all cursor-default">
                    {interest}
                  </span>
                ))}
              </div>
            </div>

            {/* Photo Gallery */}
            <div className="glass rounded-2xl p-6">
              <h2 className="font-serif text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Camera size={18} className="text-crimson-500" />
                Photo Gallery
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {PHOTO_GRADIENTS.map((grad, i) => (
                  <div
                    key={i}
                    className={`bg-gradient-to-br ${grad} rounded-xl aspect-square flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity group relative overflow-hidden`}
                    role="img"
                    aria-label={`Photo ${i + 1}`}
                  >
                    <Camera size={24} className="text-white/30 group-hover:text-white/60 transition-colors" />
                    {i === 0 && (
                      <div className="absolute bottom-2 left-2 glass px-2 py-0.5 rounded-full text-xs text-white/70">
                        Profile
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-white/30 text-xs mt-3 text-center">Some photos may require membership to view</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Compatibility */}
            <div className="glass rounded-2xl p-6 text-center">
              <h3 className="text-white font-semibold mb-4">Compatibility Score</h3>
              <div className="relative w-28 h-28 mx-auto mb-4">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="42"
                    fill="none"
                    stroke="#DC143C"
                    strokeWidth="8"
                    strokeDasharray={`${87 * 2.64} ${100 * 2.64}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-white">87%</span>
                  <span className="text-white/40 text-xs">Match</span>
                </div>
              </div>
              <p className="text-white/50 text-xs">Based on your profile and preferences</p>
              <button className="w-full btn-crimson py-2.5 rounded-xl text-sm font-semibold mt-4">
                See Full Report
              </button>
            </div>

            {/* Quick Stats */}
            <div className="glass rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4">Profile Details</h3>
              <div className="space-y-3">
                {[
                  { label: 'Gender', value: 'Woman' },
                  { label: 'Orientation', value: 'Bisexual' },
                  { label: 'Relationship', value: 'Single' },
                  { label: 'Height', value: '5\'6"' },
                  { label: 'Languages', value: 'English, French' },
                  { label: 'Last Online', value: 'Now' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-white/40">{label}</span>
                    <span className="text-white/80">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upgrade CTA */}
            <div className="glass-crimson rounded-2xl p-6 border border-crimson-500/20">
              <Crown size={24} className="text-gold-400 mb-3" />
              <h3 className="text-white font-semibold mb-2">Upgrade to Message</h3>
              <p className="text-white/50 text-sm mb-4">Unlock unlimited messaging and see who likes you with Gold.</p>
              <a href="/upgrade" className="block text-center btn-crimson py-2.5 rounded-xl text-sm font-semibold">
                View Plans
              </a>
            </div>
          </div>
        </div>

        {/* People Also Viewed */}
        <div className="max-w-5xl mx-auto px-4 pb-12">
          <h2 className="font-serif text-2xl font-bold text-white mb-6">People Also Viewed</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {ALSO_VIEWED.map((m) => (
              <MemberCard key={m.username} {...m} />
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
