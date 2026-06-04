'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Calendar, MapPin, Users, Clock, ArrowRight, Lock } from 'lucide-react';

interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  location?: string;
  category?: string;
  attendeeCount?: number;
  maxAttendees?: number;
  isFeatured?: boolean;
  isPrivate?: boolean;
  imageUrl?: string;
  gradient?: string;
}

interface Props {
  events: Event[];
  featured: Event | null;
  activeCategory: string;
}

const TABS = ['All', 'Party', 'Meetup', 'Workshop', 'Travel'];

const CATEGORY_COLORS: Record<string, string> = {
  Party: 'bg-[#DC143C]/20 text-[#DC143C] border-[#DC143C]/30',
  Meetup: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Workshop: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Travel: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  Dining: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Culture: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  Social: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const DEFAULT_GRADIENTS = [
  'from-[#DC143C]/60 via-red-900 to-black',
  'from-amber-900 to-red-900',
  'from-emerald-900 to-teal-800',
  'from-indigo-900 to-purple-800',
  'from-violet-900 to-blue-900',
  'from-blue-900 to-cyan-800',
];

export default function EventsClient({ events, featured, activeCategory }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const [rsvpDone, setRsvpDone] = useState<Set<string>>(new Set());

  function setCategory(cat: string) {
    const params = new URLSearchParams();
    if (cat !== 'All') params.set('category', cat);
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleRSVP(eventId: string, isPrivate?: boolean) {
    if (isPrivate) return; // Locked for free users
    setRsvpLoading(eventId);
    try {
      await fetch(`/api/events/${eventId}/attend`, { method: 'POST' });
      setRsvpDone((prev) => new Set(prev).add(eventId));
    } finally {
      setRsvpLoading(null);
    }
  }

  const filteredEvents = activeCategory === 'All'
    ? events
    : events.filter((e) => e.category?.toLowerCase() === activeCategory.toLowerCase());

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Featured Event */}
      {featured && (
        <div className={`relative rounded-3xl overflow-hidden bg-gradient-to-br ${featured.gradient || DEFAULT_GRADIENTS[0]} p-8 md:p-12 mb-12`}>
          {featured.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={featured.imageUrl} alt={featured.title} className="absolute inset-0 w-full h-full object-cover opacity-30" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent" />

          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest">
                  ★ Featured Event
                </span>
                {featured.category && (
                  <span className={`${CATEGORY_COLORS[featured.category] || 'bg-white/20 text-white border-white/20'} border px-3 py-1 rounded-full text-xs font-semibold`}>
                    {featured.category}
                  </span>
                )}
              </div>

              <h2 className="font-serif text-3xl md:text-4xl font-bold text-white mb-4">{featured.title}</h2>
              {featured.description && (
                <p className="text-white/70 text-sm leading-relaxed mb-6 max-w-xl">{featured.description}</p>
              )}

              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { icon: Calendar, text: featured.date },
                  { icon: Clock, text: featured.time || 'TBD' },
                  { icon: MapPin, text: featured.location || 'TBD' },
                  { icon: Users, text: featured.maxAttendees ? `${featured.attendeeCount ?? 0}/${featured.maxAttendees} spots` : `${featured.attendeeCount ?? 0} attending` },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-white/70 text-sm">
                    <Icon size={14} className="text-[#DC143C] flex-shrink-0" />
                    {text}
                  </div>
                ))}
              </div>

              {featured.maxAttendees && (
                <div className="mb-6">
                  <div className="flex justify-between text-xs text-white/50 mb-1">
                    <span>Spots filled</span>
                    <span>{Math.round(((featured.attendeeCount ?? 0) / featured.maxAttendees) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#DC143C] rounded-full" style={{ width: `${((featured.attendeeCount ?? 0) / featured.maxAttendees) * 100}%` }} />
                  </div>
                </div>
              )}

              <button
                onClick={() => handleRSVP(featured.id, featured.isPrivate)}
                disabled={rsvpDone.has(featured.id) || rsvpLoading === featured.id}
                className="bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-8 py-3 rounded-xl font-semibold flex items-center gap-2 text-sm transition-all disabled:opacity-70"
              >
                {rsvpLoading === featured.id ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : rsvpDone.has(featured.id) ? (
                  '✓ RSVP Confirmed!'
                ) : (
                  <>RSVP Now <ArrowRight size={16} /></>
                )}
              </button>
            </div>

            {featured.maxAttendees && (
              <div className="flex flex-col items-center gap-4">
                <div className="glass rounded-2xl p-6 text-center w-40">
                  <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Date</p>
                  <p className="text-white font-bold text-lg">{featured.date}</p>
                </div>
                <div className="glass rounded-2xl p-6 text-center w-40">
                  <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Spots Left</p>
                  <p className="text-white font-bold text-3xl">{featured.maxAttendees - (featured.attendeeCount ?? 0)}</p>
                  <p className="text-white/40 text-xs">of {featured.maxAttendees}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Filter Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setCategory(tab)}
            className={`px-5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeCategory === tab ? 'bg-[#DC143C] text-white' : 'glass text-white/60 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-white/30 text-lg">No events found</p>
          <p className="text-white/20 text-sm mt-1">Check back soon for upcoming events</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event, idx) => {
            const gradient = event.gradient || DEFAULT_GRADIENTS[idx % DEFAULT_GRADIENTS.length];
            const isLocked = event.isPrivate;
            const done = rsvpDone.has(event.id);
            const isLoading = rsvpLoading === event.id;
            const spotsLeft = event.maxAttendees ? event.maxAttendees - (event.attendeeCount ?? 0) : null;

            return (
              <div key={event.id} className="glass rounded-2xl overflow-hidden group">
                <div className={`bg-gradient-to-br ${gradient} h-32 flex items-end p-4 relative overflow-hidden`}>
                  {event.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={event.imageUrl} alt={event.title} className="absolute inset-0 w-full h-full object-cover opacity-40" />
                  )}
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="relative z-10 flex items-end justify-between w-full">
                    {event.category && (
                      <span className={`${CATEGORY_COLORS[event.category] || 'bg-white/20 text-white border-white/20'} border px-2.5 py-1 rounded-full text-xs font-semibold`}>
                        {event.category}
                      </span>
                    )}
                    <div className="glass px-2 py-1 rounded-lg text-white text-xs font-semibold">{event.date}</div>
                  </div>
                  {isLocked && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="text-center">
                        <Lock size={28} className="text-[#D4AF37] mx-auto mb-1" />
                        <p className="text-[#D4AF37] text-xs font-semibold">Gold Members Only</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <h3 className="text-white font-semibold text-base mb-3 group-hover:text-[#DC143C] transition-colors leading-snug">
                    {event.title}
                  </h3>

                  <div className="space-y-2 mb-4">
                    {event.time && (
                      <div className="flex items-center gap-2 text-white/50 text-xs">
                        <Clock size={12} />{event.time}
                      </div>
                    )}
                    {event.location && (
                      <div className="flex items-center gap-2 text-white/50 text-xs">
                        <MapPin size={12} />{event.location}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white/40 text-xs">
                      <Users size={12} />
                      {event.attendeeCount ?? 0} attending
                    </div>
                    <button
                      onClick={() => handleRSVP(event.id, isLocked)}
                      disabled={isLocked || done || isLoading}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                        isLocked ? 'glass text-[#D4AF37] cursor-not-allowed' :
                        done ? 'bg-emerald-600 text-white cursor-default' :
                        'bg-[#DC143C] hover:bg-[#FF1744] text-white'
                      }`}
                    >
                      {isLoading ? '...' : isLocked ? 'Gold Only' : done ? '✓ RSVP\'d' : 'RSVP'}
                    </button>
                  </div>

                  {spotsLeft !== null && spotsLeft < 10 && !isLocked && (
                    <p className="text-amber-400 text-xs mt-3 font-medium">
                      ⚡ Only {spotsLeft} spot{spotsLeft === 1 ? '' : 's'} left!
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
