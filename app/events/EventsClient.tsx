'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Calendar, MapPin, Users, Clock, ArrowRight, Lock, Plus, History, X } from 'lucide-react';
import { getAvatarUrl } from '@/lib/avatar';
import CreateEventModal from './CreateEventModal';

export interface EventItem {
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
  /** current user has RSVP'd GOING */
  attending?: boolean;
}

interface Attendee {
  username: string;
  displayName: string | null;
  profilePhoto: string | null;
}

interface Props {
  events: EventItem[];
  featured: EventItem | null;
  pastEvents?: EventItem[];
  activeCategory: string;
  canCreate?: boolean;
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

export default function EventsClient({ events, featured, pastEvents = [], activeCategory, canCreate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [rsvpLoading, setRsvpLoading] = useState<string | null>(null);
  const [rsvpDone, setRsvpDone] = useState<Set<string>>(
    () => new Set(events.filter((e) => e.attending).map((e) => e.id))
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [whoWent, setWhoWent] = useState<{ event: EventItem; attendees: Attendee[] | null; error?: string } | null>(null);

  async function openWhoWent(event: EventItem) {
    setWhoWent({ event, attendees: null });
    try {
      const res = await fetch(`/api/events/${event.id}/attendees`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWhoWent({ event, attendees: [], error: data.error || 'Could not load attendees' });
        return;
      }
      setWhoWent({ event, attendees: data.attendees ?? [] });
    } catch {
      setWhoWent({ event, attendees: [], error: 'Could not load attendees' });
    }
  }

  function setCategory(cat: string) {
    const params = new URLSearchParams();
    if (cat !== 'All') params.set('category', cat);
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleRSVP(eventId: string, isPrivate?: boolean) {
    if (isPrivate) return; // Locked for free users
    setRsvpLoading(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}/attend`, { method: 'POST' });
      if (res.ok) setRsvpDone((prev) => new Set(prev).add(eventId));
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
        <div className={`relative rounded-3xl overflow-hidden bg-gradient-to-br ${featured.gradient || DEFAULT_GRADIENTS[0]} p-6 sm:p-8 md:p-12 mb-10`}>
          {featured.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={featured.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent" />

          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {[
                  { icon: Calendar, text: featured.date },
                  { icon: Clock, text: featured.time || 'TBD' },
                  { icon: MapPin, text: featured.location || 'TBD' },
                  { icon: Users, text: featured.maxAttendees ? `${featured.attendeeCount ?? 0}/${featured.maxAttendees} spots` : `${featured.attendeeCount ?? 0} attending` },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-white/70 text-sm">
                    <Icon size={14} className="text-[#FF4D6D] flex-shrink-0" aria-hidden="true" />
                    {text}
                  </div>
                ))}
              </div>

              {featured.maxAttendees && (
                <div className="mb-6">
                  <div className="flex justify-between text-xs text-white/65 mb-1">
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

            {/* Side summary — desktop only; on phones it just repeated the details above. */}
            {featured.maxAttendees && (
              <div className="hidden md:flex flex-col items-center gap-4">
                <div className="glass rounded-2xl p-6 text-center w-40">
                  <p className="text-white/60 text-xs uppercase tracking-widest mb-1">Date</p>
                  <p className="text-white font-bold text-lg">{featured.date}</p>
                </div>
                <div className="glass rounded-2xl p-6 text-center w-40">
                  <p className="text-white/60 text-xs uppercase tracking-widest mb-1">Spots Left</p>
                  <p className="text-white font-bold text-3xl">{featured.maxAttendees - (featured.attendeeCount ?? 0)}</p>
                  <p className="text-white/60 text-xs">of {featured.maxAttendees}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Filter + Create Button */}
      {canCreate && (
      <div className="flex items-center justify-end gap-4 mb-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap shrink-0"
          >
            <Plus size={16} aria-hidden="true" /> Create event
          </button>
      </div>
      )}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setCategory(tab)}
            aria-pressed={activeCategory === tab}
            className={`px-5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              activeCategory === tab ? 'bg-[#DC143C] text-white' : 'glass text-white/70 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-16 glass rounded-2xl px-6">
          <Calendar size={32} className="text-[#FF4D6D] mx-auto mb-4" aria-hidden="true" />
          <p className="text-white font-serif text-xl font-bold mb-1">Nothing on the calendar here yet</p>
          <p className="text-white/65 text-sm">New member evenings are added regularly — check back soon, or try another category.</p>
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
                      <div className="flex items-center gap-2 text-white/65 text-xs">
                        <Clock size={12} />{event.time}
                      </div>
                    )}
                    {event.location && (
                      <div className="flex items-center gap-2 text-white/65 text-xs">
                        <MapPin size={12} />{event.location}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white/60 text-xs">
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
      {/* Past Events */}
      {pastEvents.length > 0 && (
        <section className="mt-16" aria-labelledby="past-events-heading">
          <div className="flex items-center gap-2 mb-6">
            <History size={18} className="text-[#D4AF37]" />
            <h2 id="past-events-heading" className="font-serif text-2xl font-bold text-white">Past events</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastEvents.map((event) => (
              <div key={event.id} className="glass rounded-2xl p-5 flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-2">
                  {event.category && (
                    <span className={`${CATEGORY_COLORS[event.category] || 'bg-white/10 text-white/60 border-white/10'} border px-2 py-0.5 rounded-full text-[11px] font-semibold`}>
                      {event.category}
                    </span>
                  )}
                  <span className="text-white/60 text-xs">{event.date}</span>
                </div>
                <h3 className="text-white/90 font-semibold text-sm mb-2 leading-snug">{event.title}</h3>
                {event.location && (
                  <div className="flex items-center gap-2 text-white/60 text-xs mb-3">
                    <MapPin size={12} />{event.location}
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-white/60 text-xs">
                    <Users size={12} />{event.attendeeCount ?? 0} went
                  </span>
                  {event.attending ? (
                    <button
                      onClick={() => openWhoWent(event)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors"
                    >
                      See who went
                    </button>
                  ) : (
                    <span className="text-white/25 text-xs">Ended</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Who went modal */}
      {whoWent && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Who went to ${whoWent.event.title}`}
          onClick={() => setWhoWent(null)}
        >
          <div className="glass rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[#D4AF37] text-xs uppercase tracking-widest mb-1">Who went</p>
                <h3 className="text-white font-bold text-lg leading-snug">{whoWent.event.title}</h3>
              </div>
              <button onClick={() => setWhoWent(null)} className="text-white/60 hover:text-white transition-colors" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            {whoWent.attendees === null ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#DC143C] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : whoWent.error ? (
              <p className="text-red-400 text-sm">{whoWent.error}</p>
            ) : whoWent.attendees.length === 0 ? (
              <p className="text-white/60 text-sm">No other members to show for this event.</p>
            ) : (
              <ul className="space-y-2">
                {whoWent.attendees.map((a) => (
                  <li key={a.username}>
                    <Link
                      href={`/members/${a.username}`}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getAvatarUrl(a.username, a.profilePhoto)}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{a.displayName || a.username}</p>
                        <p className="text-white/60 text-xs truncate">@{a.username}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateEventModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); router.refresh(); }}
        />
      )}
    </div>
  );
}
