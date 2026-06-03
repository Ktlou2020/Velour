import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Calendar, MapPin, Users, Clock, ArrowRight } from 'lucide-react';

const FEATURED_EVENT = {
  title: 'Velour Grand Soirée — London',
  date: 'Saturday, 21 December 2024',
  time: '8:00 PM – 2:00 AM',
  location: 'The Savoy, London, UK',
  description: 'Our most exclusive event of the year. An evening of champagne, jazz, candlelit conversations, and extraordinary connections. Dress code: Black Tie. Members only.',
  attendees: 124,
  maxAttendees: 150,
  category: 'Party',
  gradient: 'from-crimson-900 via-red-900 to-black',
};

const EVENTS = [
  { id: 1, title: 'Wine & Jazz Tasting Evening', date: 'Dec 14', time: '7:00 PM', location: 'Paris, FR', attendees: 32, max: 40, category: 'Social', gradient: 'from-amber-900 to-red-900' },
  { id: 2, title: 'Lifestyle Photography Walk', date: 'Dec 16', time: '10:00 AM', location: 'Amsterdam, NL', attendees: 18, max: 25, category: 'Meetup', gradient: 'from-emerald-900 to-teal-800' },
  { id: 3, title: 'Premium Members Dinner', date: 'Dec 17', time: '8:00 PM', location: 'New York, US', attendees: 48, max: 60, category: 'Dining', gradient: 'from-indigo-900 to-purple-800' },
  { id: 4, title: 'Mindful Connection Workshop', date: 'Dec 18', time: '2:00 PM', location: 'Online', attendees: 67, max: 100, category: 'Workshop', gradient: 'from-violet-900 to-blue-900' },
  { id: 5, title: 'Ski Weekend — Val d\'Isère', date: 'Dec 20–22', time: 'All Weekend', location: 'Val d\'Isère, FR', attendees: 22, max: 30, category: 'Travel', gradient: 'from-blue-900 to-cyan-800' },
  { id: 6, title: 'Art Gallery Night — Mayfair', date: 'Dec 23', time: '6:00 PM', location: 'London, UK', attendees: 41, max: 60, category: 'Culture', gradient: 'from-rose-900 to-pink-800' },
  { id: 7, title: 'New Year\'s Eve Ball — Dubai', date: 'Dec 31', time: '9:00 PM', location: 'Dubai, UAE', attendees: 89, max: 120, category: 'Party', gradient: 'from-yellow-900 to-amber-800' },
  { id: 8, title: 'Couples Retreat — Barcelona', date: 'Jan 10–12', time: 'Weekend', location: 'Barcelona, ES', attendees: 16, max: 20, category: 'Travel', gradient: 'from-orange-900 to-red-800' },
  { id: 9, title: 'Velour Book Club — January', date: 'Jan 15', time: '7:00 PM', location: 'Online + London', attendees: 29, max: 50, category: 'Workshop', gradient: 'from-teal-900 to-emerald-800' },
];

const TABS = ['All', 'Parties', 'Meetups', 'Workshops', 'Travel'];
const CATEGORY_COLORS: Record<string, string> = {
  Party: 'bg-crimson-500/20 text-crimson-400 border-crimson-500/30',
  Social: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Meetup: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Dining: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Workshop: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Travel: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  Culture: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

function AttendeeAvatars({ count, gradient }: { count: number; gradient: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {Array.from({ length: Math.min(4, count) }).map((_, i) => (
          <div key={i} className={`w-6 h-6 rounded-full bg-gradient-to-br ${gradient} border-2 border-[#0A0A0F] text-white text-xs flex items-center justify-center font-bold`} />
        ))}
      </div>
      <span className="text-white/50 text-xs">{count} attending</span>
    </div>
  );
}

export default function EventsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />

      <main className="pt-16">
        {/* Header */}
        <div className="bg-gradient-to-b from-[#0F0A1E] to-[#0A0A0F] py-12 px-4 border-b border-white/5">
          <div className="max-w-6xl mx-auto">
            <h1 className="font-serif text-4xl font-bold text-white mb-2">Events</h1>
            <p className="text-white/50">Exclusive gatherings, experiences and adventures for Velour members</p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-10">
          {/* Featured Event */}
          <div className={`relative rounded-3xl overflow-hidden bg-gradient-to-br ${FEATURED_EVENT.gradient} p-8 md:p-12 mb-12 card-hover`}>
            <div className="absolute inset-0 shimmer pointer-events-none" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

            <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-gold-500/20 text-gold-400 border border-gold-500/30 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest">
                    ★ Featured Event
                  </span>
                  <span className={`${CATEGORY_COLORS[FEATURED_EVENT.category]} border px-3 py-1 rounded-full text-xs font-semibold`}>
                    {FEATURED_EVENT.category}
                  </span>
                </div>

                <h2 className="font-serif text-3xl md:text-4xl font-bold text-white mb-4">{FEATURED_EVENT.title}</h2>
                <p className="text-white/70 text-sm leading-relaxed mb-6 max-w-xl">{FEATURED_EVENT.description}</p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  {[
                    { icon: Calendar, text: FEATURED_EVENT.date },
                    { icon: Clock, text: FEATURED_EVENT.time },
                    { icon: MapPin, text: FEATURED_EVENT.location },
                    { icon: Users, text: `${FEATURED_EVENT.attendees}/${FEATURED_EVENT.maxAttendees} spots` },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2 text-white/70 text-sm">
                      <Icon size={14} className="text-crimson-400 flex-shrink-0" />
                      {text}
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-xs text-white/50 mb-1">
                    <span>Spots filled</span>
                    <span>{Math.round((FEATURED_EVENT.attendees / FEATURED_EVENT.maxAttendees) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-crimson-500 rounded-full"
                      style={{ width: `${(FEATURED_EVENT.attendees / FEATURED_EVENT.maxAttendees) * 100}%` }}
                    />
                  </div>
                </div>

                <button className="btn-crimson px-8 py-3 rounded-xl font-semibold flex items-center gap-2 text-sm">
                  RSVP Now <ArrowRight size={16} />
                </button>
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="glass rounded-2xl p-6 text-center w-40">
                  <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Date</p>
                  <p className="text-white font-bold text-lg">Dec 21</p>
                  <p className="text-crimson-400 text-sm">2024</p>
                </div>
                <div className="glass rounded-2xl p-6 text-center w-40">
                  <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Spots Left</p>
                  <p className="text-white font-bold text-3xl">{FEATURED_EVENT.maxAttendees - FEATURED_EVENT.attendees}</p>
                  <p className="text-white/40 text-xs">of {FEATURED_EVENT.maxAttendees}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`px-5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  tab === 'All'
                    ? 'bg-crimson-500 text-white'
                    : 'glass text-white/60 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Events Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {EVENTS.map((event) => (
              <div key={event.id} className="glass rounded-2xl overflow-hidden card-hover group">
                {/* Event Header */}
                <div className={`bg-gradient-to-br ${event.gradient} h-32 flex items-end p-4 relative`}>
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="relative z-10 flex items-end justify-between w-full">
                    <span className={`${CATEGORY_COLORS[event.category] || 'bg-white/20 text-white border-white/20'} border px-2.5 py-1 rounded-full text-xs font-semibold`}>
                      {event.category}
                    </span>
                    <div className="glass px-2 py-1 rounded-lg text-white text-xs font-semibold">
                      {event.date}
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-white font-semibold text-base mb-3 group-hover:text-crimson-400 transition-colors leading-snug">
                    {event.title}
                  </h3>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-white/50 text-xs">
                      <Clock size={12} />
                      {event.time}
                    </div>
                    <div className="flex items-center gap-2 text-white/50 text-xs">
                      <MapPin size={12} />
                      {event.location}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <AttendeeAvatars count={event.attendees} gradient={event.gradient} />
                    <button className="text-xs btn-crimson px-3 py-1.5 rounded-lg font-semibold">
                      RSVP
                    </button>
                  </div>

                  {event.max - event.attendees < 10 && (
                    <p className="text-amber-400 text-xs mt-3 font-medium">
                      ⚡ Only {event.max - event.attendees} spots left!
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
