import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import EventsClient from './EventsClient';

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

async function getEvents(category?: string) {
  try {
    const qs = category && category !== 'All' ? `?category=${encodeURIComponent(category)}` : '';
    const res = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/events${qs}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return { events: [], featured: null };
    const data = await res.json();
    const events: Event[] = data.events || data || [];
    const featured = events.find((e) => e.isFeatured) || events[0] || null;
    return { events, featured };
  } catch {
    return { events: [], featured: null };
  }
}

interface SearchParams { category?: string }

export default async function EventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { events, featured } = await getEvents(params.category);

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        <div className="bg-gradient-to-b from-[#0F0A1E] to-[#0A0A0F] py-12 px-4 border-b border-white/5">
          <div className="max-w-6xl mx-auto">
            <h1 className="font-serif text-4xl font-bold text-white mb-2">Events</h1>
            <p className="text-white/50">Exclusive gatherings, experiences and adventures for Velour members</p>
          </div>
        </div>
        <EventsClient events={events} featured={featured} activeCategory={params.category || 'All'} />
      </main>
      <Footer />
    </div>
  );
}
