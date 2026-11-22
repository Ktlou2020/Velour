import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Lock, Globe, MessageSquareWarning, Flag, ShieldCheck, Mail, Crown } from 'lucide-react';
import { requireAdmin } from '@/auth';
import { db } from '@/lib/db';
import { audit } from '@/lib/admin-team';
import { ageFromDob } from '@/lib/compat';
import { isProfileReady } from '@/lib/profile-ready';
import { isValidId } from '@/lib/security';
import { CHAT_ALBUM_NAME, STORE_ALBUM_NAME, VIDEO_ALBUM_NAME } from '@/lib/media';
import { FLAG_LABELS, type FlagCategory } from '@/lib/message-flags';
import ProtectedImage from '@/components/ProtectedImage';

export const metadata = { title: 'Member — Unbound admin' };
export const dynamic = 'force-dynamic';

const fmt = (d: Date | null | undefined) =>
  d ? d.toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' }) : '—';

/** Admin view of one member: profile, every photo (public and private), activity stats, reports and message flags. Viewing is logged. */
export default async function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  if (!me) redirect('/members');
  const { id } = await params;
  if (!isValidId(id)) notFound();

  const u = await db.user.findUnique({
    where: { id },
    select: {
      id: true, username: true, email: true, role: true, isActive: true, isVerified: true, isDemo: true,
      verificationStatus: true, emailVerifiedAt: true, createdAt: true,
      profile: {
        select: {
          displayName: true, bio: true, dateOfBirth: true, gender: true, orientation: true, city: true, country: true,
          isCouple: true, membershipTier: true, foundingMemberNumber: true, lastSeen: true, isOnline: true,
          interestedIn: true, intentions: true, messagePolicy: true, snoozedUntil: true,
          profilePhoto: true, lookingFor: true,
        },
      },
    },
  });
  if (!u) notFound();

  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [
    photos, likesGiven, likesReceived, winksReceived, matches, conversations, messagesSent, messagesSent30,
    profileViews, flags, reportRows, blockedBy,
  ] = await Promise.all([
    db.photo.findMany({
      where: { userId: id, OR: [{ albumId: null }, { album: { name: { notIn: [CHAT_ALBUM_NAME, VIDEO_ALBUM_NAME, STORE_ALBUM_NAME] } } }] },
      orderBy: [{ isProfile: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, url: true, isPrivate: true, isProfile: true, createdAt: true, album: { select: { name: true, isPrivate: true } } },
    }),
    db.like.count({ where: { fromUserId: id, type: { not: 'PASS' } } }),
    db.like.count({ where: { toUserId: id, type: { not: 'PASS' } } }),
    db.like.count({ where: { toUserId: id, type: 'WINK' } }),
    db.match.count({ where: { OR: [{ user1Id: id }, { user2Id: id }] } }),
    db.conversationParticipant.count({ where: { userId: id } }),
    db.message.count({ where: { senderId: id } }),
    db.message.count({ where: { senderId: id, createdAt: { gte: since30 } } }),
    db.profileView.count({ where: { viewedId: id } }),
    db.messageFlag.findMany({ where: { senderId: id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, categories: true, excerpt: true, createdAt: true, reviewedAt: true } }),
    db.notification.findMany({
      where: { type: 'REPORT', data: { path: ['reportedUserId'], equals: id } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { data: true, createdAt: true },
    }),
    db.block.count({ where: { blockedId: id } }),
  ]);
  // A report notifies every admin; show each report once.
  const seen = new Set<string>();
  const reports = reportRows.flatMap((r) => {
    const d = (r.data ?? {}) as { reportedBy?: string; reason?: string; details?: string };
    const key = `${d.reportedBy}|${d.reason}|${Math.floor(r.createdAt.getTime() / 60000)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ reason: d.reason ?? 'Report', details: d.details ?? '', reportedBy: d.reportedBy ?? null, createdAt: r.createdAt }];
  });
  const reporterIds = [...new Set(reports.map((r) => r.reportedBy).filter((x): x is string => !!x))];
  const reporters = reporterIds.length
    ? new Map((await db.user.findMany({ where: { id: { in: reporterIds } }, select: { id: true, username: true } })).map((r) => [r.id, r.username]))
    : new Map<string, string>();

  await audit(me.id, 'PROFILE_VIEWED', id, { username: u.username });

  const p = u.profile;
  const name = p?.displayName || u.username;
  const age = ageFromDob(p?.dateOfBirth ?? null);
  const publicPhotos = photos.filter((ph) => !(ph.album ? ph.album.isPrivate : ph.isPrivate));
  const privatePhotos = photos.filter((ph) => (ph.album ? ph.album.isPrivate : ph.isPrivate));

  const stats: { label: string; value: string | number }[] = [
    { label: 'Messages sent', value: messagesSent },
    { label: 'Sent (30 days)', value: messagesSent30 },
    { label: 'Conversations', value: conversations },
    { label: 'Matches', value: matches },
    { label: 'Likes given', value: likesGiven },
    { label: 'Likes received', value: likesReceived },
    { label: 'Winks received', value: winksReceived },
    { label: 'Profile views', value: profileViews },
    { label: 'Reports against', value: reports.length },
    { label: 'Blocked by', value: blockedBy },
    { label: 'Flagged messages', value: flags.length },
    { label: 'Profile', value: isProfileReady(u.role, p) ? 'Finished' : 'Unfinished' },
  ];

  const details: [string, string | null | undefined][] = [
    ['Email', u.email],
    ['Joined', fmt(u.createdAt)],
    ['Last seen', p?.isOnline ? 'Online now' : fmt(p?.lastSeen)],
    ['Age', age ? String(age) : null],
    ['Gender', p?.isCouple ? 'Couple' : p?.gender],
    ['Orientation', p?.orientation],
    ['Location', [p?.city, p?.country].filter(Boolean).join(', ')],
    ['Wants to meet', p?.interestedIn?.join(', ')],
    ['Here for', p?.intentions?.join(', ')],
    ['Plan', `${p?.membershipTier ?? 'FREE'}${p?.foundingMemberNumber ? ` · Founding member #${p.foundingMemberNumber}` : ''}`],
    ['Email confirmed', u.emailVerifiedAt ? fmt(u.emailVerifiedAt) : 'No'],
    ['Photo verification', u.isVerified ? 'Verified' : u.verificationStatus],
    ['Who can message them', p?.messagePolicy],
    ['Snoozed until', p?.snoozedUntil && p.snoozedUntil > new Date() ? fmt(p.snoozedUntil) : null],
  ];

  return (
    <div className="p-6 sm:p-8 max-w-5xl">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-white/55 hover:text-white text-sm mb-5"><ArrowLeft size={14} /> All users</Link>

      <div className="flex flex-col sm:flex-row gap-5 mb-6">
        <div className="w-28 h-28 rounded-2xl overflow-hidden bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center flex-shrink-0">
          {p?.profilePhoto ? <ProtectedImage src={p.profilePhoto} alt={name} className="w-full h-full" /> : <span className="text-white text-3xl font-bold">{name.slice(0, 2).toUpperCase()}</span>}
        </div>
        <div className="min-w-0">
          <h1 className="text-white text-2xl font-bold font-serif break-words">{name}{age ? <span className="text-white/60 font-normal">, {age}</span> : null}</h1>
          <p className="text-white/50 text-sm">@{u.username}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {!u.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">Banned</span>}
            {u.role === 'ADMIN' && <span className="text-xs px-2 py-0.5 rounded-full bg-[#DC143C]/20 text-[#FF4D6D]">Admin</span>}
            {u.isDemo && <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300">Demo</span>}
            {u.isVerified && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 inline-flex items-center gap-1"><ShieldCheck size={11} /> Verified</span>}
            {u.emailVerifiedAt && <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70 inline-flex items-center gap-1"><Mail size={11} /> Email confirmed</span>}
            {p?.membershipTier && p.membershipTier !== 'FREE' && <span className="text-xs px-2 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] inline-flex items-center gap-1"><Crown size={11} /> {p.membershipTier}</span>}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Link href={`/members/${u.username}`} className="glass text-white/75 hover:text-white text-xs px-3 py-1.5 rounded-lg">View public profile</Link>
            <Link href={`/admin/messages?q=${encodeURIComponent(u.username)}`} className="glass text-white/75 hover:text-white text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1"><MessageSquareWarning size={12} /> Review their messages</Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-xl p-3">
            <p className="text-white text-xl font-bold tabular-nums">{s.value}</p>
            <p className="text-white/50 text-[11px]">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Photos */}
          <section className="glass rounded-2xl p-5">
            <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-1.5"><Globe size={14} /> Public photos ({publicPhotos.length})</h2>
            {publicPhotos.length === 0 ? <p className="text-white/45 text-sm">None</p> : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {publicPhotos.map((ph) => (
                  <a key={ph.id} href={ph.url} target="_blank" rel="noreferrer" className="relative aspect-square rounded-lg overflow-hidden block">
                    <ProtectedImage src={ph.url} alt="" className="w-full h-full" />
                    {ph.isProfile && <span className="absolute bottom-1 left-1 text-[10px] bg-[#DC143C]/85 text-white px-1.5 rounded">Main</span>}
                  </a>
                ))}
              </div>
            )}
            <h2 className="text-white font-semibold text-sm mt-5 mb-3 flex items-center gap-1.5"><Lock size={14} /> Private photos and albums ({privatePhotos.length})</h2>
            {privatePhotos.length === 0 ? <p className="text-white/45 text-sm">None</p> : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {privatePhotos.map((ph) => (
                  <a key={ph.id} href={ph.url} target="_blank" rel="noreferrer" className="relative aspect-square rounded-lg overflow-hidden block">
                    <ProtectedImage src={ph.url} alt="" className="w-full h-full" />
                    {ph.album && <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1.5 rounded truncate max-w-[90%]">{ph.album.name}</span>}
                  </a>
                ))}
              </div>
            )}
          </section>

          {p?.bio && (
            <section className="glass rounded-2xl p-5">
              <h2 className="text-white font-semibold text-sm mb-2">Bio</h2>
              <p className="text-white/75 text-sm whitespace-pre-wrap break-words">{p.bio}</p>
            </section>
          )}

          {/* Reports */}
          <section className="glass rounded-2xl p-5">
            <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-1.5"><Flag size={14} className="text-orange-400" /> Reports against them ({reports.length})</h2>
            {reports.length === 0 ? <p className="text-white/45 text-sm">None</p> : (
              <ul className="space-y-2">
                {reports.map((r, i) => (
                  <li key={i} className="text-sm bg-white/5 rounded-xl px-3 py-2">
                    <div className="flex justify-between gap-2"><span className="text-white">{r.reason}</span><span className="text-white/40 text-xs">{fmt(r.createdAt)}</span></div>
                    {r.details && <p className="text-white/65 text-xs mt-0.5">{r.details}</p>}
                    {r.reportedBy && <p className="text-white/40 text-xs mt-0.5">by @{reporters.get(r.reportedBy) ?? 'deleted'}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Flagged messages */}
          <section className="glass rounded-2xl p-5">
            <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-1.5"><MessageSquareWarning size={14} className="text-amber-300" /> Flagged messages ({flags.length})</h2>
            {flags.length === 0 ? <p className="text-white/45 text-sm">None</p> : (
              <ul className="space-y-2">
                {flags.map((f) => (
                  <li key={f.id} className="text-sm bg-white/5 rounded-xl px-3 py-2">
                    <div className="flex justify-between gap-2">
                      <span className="text-amber-200 text-xs">{f.categories.map((c) => FLAG_LABELS[c as FlagCategory] ?? c).join(', ')}{f.reviewedAt ? <span className="text-white/40"> · reviewed</span> : null}</span>
                      <span className="text-white/40 text-xs">{fmt(f.createdAt)}</span>
                    </div>
                    <p className="text-white/80 text-xs mt-0.5 break-words">“{f.excerpt}”</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Details */}
        <aside className="glass rounded-2xl p-5 h-fit">
          <h2 className="text-white font-semibold text-sm mb-3">Details</h2>
          <dl className="space-y-2.5">
            {details.filter(([, v]) => !!v).map(([k, v]) => (
              <div key={k} className="text-sm">
                <dt className="text-white/45 text-xs">{k}</dt>
                <dd className="text-white/85 break-words">{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}
