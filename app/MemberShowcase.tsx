import { db } from '@/lib/db';
import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';

const GRADIENTS = [
  'from-rose-900 to-red-800',
  'from-indigo-900 to-purple-800',
  'from-emerald-900 to-teal-700',
  'from-amber-900 to-orange-800',
  'from-pink-900 to-rose-700',
  'from-blue-900 to-cyan-800',
  'from-violet-900 to-purple-700',
  'from-yellow-900 to-amber-700',
];

export default async function MemberShowcase() {
  const users = await db.user.findMany({
    where: { isActive: true, profile: { profilePhoto: { not: null } } },
    select: {
      username: true,
      profile: {
        select: {
          displayName: true,
          profilePhoto: true,
          city: true,
          country: true,
          dateOfBirth: true,
          isOnline: true,
          membershipTier: true,
        },
      },
      photos: {
        where: { isProfile: true, isPrivate: false },
        take: 1,
        select: { url: true },
      },
    },
    orderBy: [{ profile: { isOnline: 'desc' } }, { profile: { lastSeen: 'desc' } }],
    take: 8,
  });

  // Fallback placeholders if DB is empty
  const fallback = [
    { username: 'Sofia_M', age: 28, location: 'London' },
    { username: 'JakeM', age: 34, location: 'New York' },
    { username: 'Anna', age: 26, location: 'Paris' },
    { username: 'Carlos', age: 31, location: 'Madrid' },
    { username: 'Lily', age: 29, location: 'Sydney' },
    { username: 'Max', age: 36, location: 'Amsterdam' },
    { username: 'Irina', age: 27, location: 'Dubai' },
    { username: 'Tom', age: 33, location: 'Cape Town' },
  ];

  const onlineCount = users.filter(u => u.profile?.isOnline).length;

  return (
    <section className="py-24 px-4 bg-[#0F0A1E]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#DC143C] text-sm font-semibold tracking-widest uppercase mb-3">Our Community</p>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-white mb-4">Join Our Community</h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Thousands of extraordinary people waiting to meet someone just like you.
          </p>
          {onlineCount > 0 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-emerald-400 text-sm font-medium">{onlineCount} member{onlineCount !== 1 ? 's' : ''} online right now</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {(users.length > 0 ? users : fallback).map((m, i) => {
            const isReal = 'profile' in m;
            if (isReal) {
              const u = m as typeof users[0];
              const photo = u.photos[0]?.url ?? u.profile?.profilePhoto;
              const name = u.profile?.displayName || u.username;
              const initials = name.slice(0, 2).toUpperCase();
              const location = [u.profile?.city, u.profile?.country].filter(Boolean).join(', ');
              const age = u.profile?.dateOfBirth
                ? Math.floor((Date.now() - new Date(u.profile.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                : null;

              return (
                <Link key={u.username} href={`/members/${u.username}`} className="glass rounded-2xl overflow-hidden hover:bg-white/5 transition-all hover:scale-[1.02] group cursor-pointer">
                  <div className={`bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} h-36 flex items-center justify-center relative overflow-hidden`}>
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <span className="text-white text-3xl font-bold font-serif">{initials}</span>
                    )}
                    {u.profile?.isOnline && (
                      <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0A0A0F] animate-pulse" />
                    )}
                    {u.profile?.membershipTier === 'GOLD' && (
                      <div className="absolute top-2 left-2 text-[10px] font-bold text-[#D4AF37] glass px-1.5 py-0.5 rounded-md">✦ GOLD</div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="text-white font-semibold text-sm truncate">{name}{age ? `, ${age}` : ''}</div>
                    {location && (
                      <div className="text-white/50 text-xs flex items-center gap-1 mt-0.5">
                        <MapPin size={10} />
                        <span className="truncate">{location}</span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            } else {
              // Fallback placeholder
              const f = m as typeof fallback[0];
              return (
                <div key={f.username} className={`glass rounded-2xl overflow-hidden`}>
                  <div className={`bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} h-36 flex items-center justify-center`}>
                    <span className="text-white text-3xl font-bold font-serif">{f.username.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="p-3">
                    <div className="text-white font-semibold text-sm">{f.username}</div>
                    <div className="text-white/50 text-xs flex items-center gap-1 mt-0.5">
                      <MapPin size={10} />{f.age} · {f.location}
                    </div>
                  </div>
                </div>
              );
            }
          })}
        </div>

        <div className="text-center">
          <Link href="/auth/signup" className="inline-flex items-center gap-2 bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white px-8 py-3 rounded-xl font-semibold transition-all">
            View All Members <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
