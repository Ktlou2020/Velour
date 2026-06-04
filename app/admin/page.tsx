import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { Users, Activity, TrendingUp, MessageSquare, Heart, Flag } from 'lucide-react';
import AdminActions from './AdminActions';

export default async function AdminDashboard() {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;

  if (!sessionUser?.id || sessionUser.role !== 'ADMIN') {
    redirect('/members');
  }

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalUsers, activeToday, newThisWeek, totalMessages, totalMatches, pendingReports] =
    await Promise.all([
      db.user.count(),
      db.profile.count({ where: { lastSeen: { gte: oneDayAgo } } }),
      db.user.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      db.message.count(),
      db.match.count(),
      db.notification.count({ where: { type: 'REPORT', isRead: false } }),
    ]);

  const recentSignups = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      username: true,
      email: true,
      createdAt: true,
      isVerified: true,
      isActive: true,
      profile: {
        select: { membershipTier: true },
      },
    },
  });

  const pendingReportsList = await db.notification.findMany({
    where: { type: 'REPORT', isRead: false },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      user: {
        select: { username: true },
      },
    },
  });

  const statCards = [
    { icon: Users, label: 'Total Users', value: totalUsers, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { icon: Activity, label: 'Active Today', value: activeToday, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { icon: TrendingUp, label: 'New This Week', value: newThisWeek, color: 'text-[#D4AF37]', bg: 'bg-[#D4AF37]/10' },
    { icon: MessageSquare, label: 'Total Messages', value: totalMessages, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { icon: Heart, label: 'Total Matches', value: totalMatches, color: 'text-[#DC143C]', bg: 'bg-[#DC143C]/10' },
    { icon: Flag, label: 'Pending Reports', value: pendingReports, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-white text-2xl font-bold font-serif">Dashboard</h1>
        <p className="text-white/40 text-sm mt-1">Overview of Velour platform activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {statCards.map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="glass rounded-2xl p-5">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon className={color} size={20} />
            </div>
            <div className="text-white text-3xl font-bold mb-1">{value.toLocaleString()}</div>
            <div className="text-white/40 text-sm">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent Signups */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Users size={16} className="text-[#DC143C]" />
            Recent Signups
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/30 text-xs border-b border-white/5">
                  <th className="text-left pb-2">User</th>
                  <th className="text-left pb-2">Tier</th>
                  <th className="text-left pb-2">Joined</th>
                  <th className="text-left pb-2">Status</th>
                  <th className="text-left pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentSignups.map((u) => (
                  <tr key={u.id} className="text-white/70">
                    <td className="py-2.5">
                      <div className="font-medium text-white">{u.username}</div>
                      <div className="text-white/30 text-xs truncate max-w-[120px]">{u.email}</div>
                    </td>
                    <td className="py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        u.profile?.membershipTier === 'PLATINUM' ? 'bg-purple-500/20 text-purple-400' :
                        u.profile?.membershipTier === 'GOLD' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' :
                        'bg-white/10 text-white/40'
                      }`}>
                        {u.profile?.membershipTier ?? 'FREE'}
                      </span>
                    </td>
                    <td className="py-2.5 text-white/40 text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-col gap-0.5">
                        {u.isVerified ? (
                          <span className="text-xs text-emerald-400">Verified</span>
                        ) : (
                          <span className="text-xs text-white/30">Unverified</span>
                        )}
                        {!u.isActive && <span className="text-xs text-red-400">Banned</span>}
                      </div>
                    </td>
                    <td className="py-2.5">
                      <AdminActions userId={u.id} isVerified={u.isVerified} isActive={u.isActive} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Reports */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Flag size={16} className="text-orange-400" />
            Pending Reports
          </h2>
          {pendingReportsList.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No pending reports</p>
          ) : (
            <div className="space-y-3">
              {pendingReportsList.map((n) => {
                const data = n.data as { reportedUserId?: string; reportedUsername?: string; reason?: string } | null;
                return (
                  <div key={n.id} className="glass rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-white text-sm font-medium">
                          Reported by: <span className="text-[#DC143C]">@{n.user.username}</span>
                        </p>
                        {data?.reportedUsername && (
                          <p className="text-white/50 text-xs mt-0.5">
                            Reported user: @{data.reportedUsername}
                          </p>
                        )}
                        {data?.reason && (
                          <p className="text-white/40 text-xs mt-1 italic">{data.reason}</p>
                        )}
                        <p className="text-white/20 text-xs mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                      </div>
                      <a
                        href="/admin/reports"
                        className="text-xs bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Review
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 glass rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <SeedButton type="forums" label="Seed Forum Categories" />
          <SeedButton type="events" label="Seed Sample Events" />
        </div>
      </div>
    </div>
  );
}

function SeedButton({ type, label }: { type: 'forums' | 'events'; label: string }) {
  return (
    <form action={async () => {
      'use server';
      await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
    }}>
      <button
        type="submit"
        className="glass border border-white/10 hover:border-white/30 text-white/70 hover:text-white px-4 py-2.5 rounded-xl text-sm transition-all"
      >
        {label}
      </button>
    </form>
  );
}
