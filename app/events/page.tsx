import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import EventsClient, { type EventItem } from './EventsClient';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { isPaid } from '@/lib/premium';

const TZ = 'Africa/Johannesburg';

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

type EventRow = {
  id: string;
  title: string;
  description: string;
  date: Date;
  endDate: Date | null;
  location: string;
  category: string;
  maxAttendees: number | null;
  isFeatured: boolean;
  isPrivate: boolean;
  imageUrl: string | null;
  _count: { attendees: number };
};

function toItem(e: EventRow, attending: Set<string>): EventItem {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    date: e.date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }),
    time: e.date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
    location: e.location,
    category: titleCase(e.category),
    attendeeCount: e._count.attendees,
    maxAttendees: e.maxAttendees ?? undefined,
    isFeatured: e.isFeatured,
    isPrivate: e.isPrivate,
    imageUrl: e.imageUrl ?? undefined,
    attending: attending.has(e.id),
  };
}

const VALID_CATEGORIES = ['PARTY', 'MEETUP', 'WORKSHOP', 'TRAVEL', 'OTHER'];

interface SearchParams { category?: string }

export default async function EventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  const cat = params.category?.toUpperCase();
  const categoryFilter = cat && VALID_CATEGORIES.includes(cat) ? { category: cat as never } : {};
  const now = new Date();
  const countGoing = { _count: { select: { attendees: { where: { status: 'GOING' } } } } } as const;

  // Query the DB directly (a server-side fetch to /api/events carries no session
  // cookie and would 401). Same visibility rule as GET /api/events: public only.
  const [upcomingRows, recentPastRows, myRsvps, profile] = await Promise.all([
    db.event.findMany({
      where: { date: { gte: now }, isPrivate: false, ...categoryFilter },
      include: countGoing,
      orderBy: { date: 'asc' },
    }).catch(() => []),
    db.event.findMany({
      where: {
        date: { lt: now },
        OR: [{ endDate: null }, { endDate: { lt: now } }],
        isPrivate: false,
      },
      include: countGoing,
      orderBy: { date: 'desc' },
      take: 9,
    }).catch(() => []),
    userId
      ? db.eventAttendee.findMany({
          where: { userId, status: 'GOING' },
          select: { eventId: true },
        }).catch(() => [])
      : Promise.resolve([] as { eventId: string }[]),
    userId
      ? db.profile.findUnique({ where: { userId }, select: { membershipTier: true } }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const attending = new Set(myRsvps.map((r) => r.eventId));

  // Past events the user attended (including private ones they were invited to)
  const attendedPastRows = attending.size
    ? await db.event.findMany({
        where: {
          id: { in: [...attending] },
          date: { lt: now },
          OR: [{ endDate: null }, { endDate: { lt: now } }],
        },
        include: countGoing,
        orderBy: { date: 'desc' },
        take: 12,
      }).catch(() => [])
    : [];

  const pastMap = new Map<string, EventRow>();
  for (const e of [...attendedPastRows, ...recentPastRows]) pastMap.set(e.id, e as EventRow);
  const pastEvents = [...pastMap.values()]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 12)
    .map((e) => toItem(e, attending));

  const events = (upcomingRows as EventRow[]).map((e) => toItem(e, attending));
  const featured = events.find((e) => e.isFeatured) || events[0] || null;

  const canCreate = userRole === 'ADMIN' || isPaid(profile?.membershipTier, userRole);

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Navbar />
      <main className="pt-16">
        <div className="bg-gradient-to-b from-[#0F0A1E] to-[#0A0A0F] py-8 sm:py-12 px-4 border-b border-white/5">
          <div className="max-w-6xl mx-auto">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-2">Events</h1>
            <p className="text-white/65">Intimate member evenings where introductions come naturally.</p>
          </div>
        </div>
        <EventsClient
          events={events}
          featured={featured}
          pastEvents={pastEvents}
          activeCategory={params.category ? titleCase(params.category) : 'All'}
          canCreate={canCreate}
        />
      </main>
      <Footer />
    </div>
  );
}
