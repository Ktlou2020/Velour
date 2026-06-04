'use client';

import { useState } from 'react';
import { Search, Shield, Ban, UserCheck, Crown } from 'lucide-react';

interface UserRow {
  id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date | string;
  profile: {
    displayName?: string | null;
    profilePhoto?: string | null;
    membershipTier?: string | null;
    lastSeen?: Date | string | null;
    isOnline?: boolean | null;
  } | null;
}

interface Props {
  initialUsers: UserRow[];
}

export default function AdminUsersClient({ initialUsers }: Props) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  async function doAction(userId: string, action: 'ban' | 'unban' | 'verify' | 'promote') {
    setActionLoading(`${userId}-${action}`);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });
      if (res.ok) {
        const { user: updated } = await res.json() as { user: Partial<UserRow> };
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, ...updated } : u))
        );
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function setTier(userId: string, tier: 'FREE' | 'GOLD' | 'PLATINUM') {
    setActionLoading(`${userId}-tier`);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'setTier', tier }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? { ...u, profile: { ...u.profile, membershipTier: tier } }
              : u
          )
        );
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSearch(q: string) {
    setSearch(q);
    if (q.length > 2) {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json() as { users: UserRow[] };
          setUsers(data.users);
        }
      } finally {
        setLoading(false);
      }
    } else if (q.length === 0) {
      setUsers(initialUsers);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold font-serif">User Management</h1>
          <p className="text-white/40 text-sm mt-1">{users.length} users total</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={14} />
          <input
            type="search"
            placeholder="Search by username or email..."
            className="input-dark pl-9 pr-4 py-2.5 rounded-xl text-sm w-72"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/30 text-xs border-b border-white/5">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Tier</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-left px-4 py-3">Last Seen</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-white/30">
                    <div className="w-6 h-6 border-2 border-[#DC143C] border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-white/30">No users found</td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {u.profile?.profilePhoto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.profile.profilePhoto} alt={u.username} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white text-xs font-bold">{u.username.slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className="text-white font-medium">{u.username}</div>
                          {u.profile?.displayName && (
                            <div className="text-white/30 text-xs">{u.profile.displayName}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/50 truncate max-w-[180px]">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.profile?.membershipTier ?? 'FREE'}
                        disabled={actionLoading === `${u.id}-tier`}
                        onChange={(e) => setTier(u.id, e.target.value as 'FREE' | 'GOLD' | 'PLATINUM')}
                        className={`text-xs px-2 py-1 rounded-lg border bg-transparent cursor-pointer transition-colors ${
                          u.profile?.membershipTier === 'PLATINUM' ? 'border-purple-500/40 text-purple-400' :
                          u.profile?.membershipTier === 'GOLD' ? 'border-[#D4AF37]/40 text-[#D4AF37]' :
                          'border-white/10 text-white/40'
                        }`}
                      >
                        <option value="FREE" className="bg-[#0A0A0F] text-white">FREE</option>
                        <option value="GOLD" className="bg-[#0A0A0F] text-white">GOLD</option>
                        <option value="PLATINUM" className="bg-[#0A0A0F] text-white">PLATINUM</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        u.role === 'ADMIN' ? 'bg-[#DC143C]/20 text-[#DC143C]' : 'bg-white/10 text-white/40'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {u.isVerified ? (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <UserCheck size={10} /> Verified
                          </span>
                        ) : (
                          <span className="text-xs text-white/30">Unverified</span>
                        )}
                        {!u.isActive && (
                          <span className="text-xs text-red-400 flex items-center gap-1">
                            <Ban size={10} /> Banned
                          </span>
                        )}
                        {u.profile?.isOnline && (
                          <span className="text-xs text-emerald-400">Online</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">
                      {u.profile?.lastSeen ? new Date(u.profile.lastSeen).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {!u.isVerified && (
                          <button
                            onClick={() => doAction(u.id, 'verify')}
                            disabled={!!actionLoading}
                            title="Verify email"
                            className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 flex items-center justify-center transition-colors"
                          >
                            <Shield size={12} />
                          </button>
                        )}
                        {u.role !== 'ADMIN' && (
                          <button
                            onClick={() => doAction(u.id, 'promote')}
                            disabled={!!actionLoading}
                            title="Promote to Admin"
                            className="w-7 h-7 rounded-lg bg-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37]/30 flex items-center justify-center transition-colors"
                          >
                            <Crown size={12} />
                          </button>
                        )}
                        {u.isActive ? (
                          <button
                            onClick={() => doAction(u.id, 'ban')}
                            disabled={!!actionLoading}
                            title="Ban user"
                            className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                          >
                            <Ban size={12} />
                          </button>
                        ) : (
                          <button
                            onClick={() => doAction(u.id, 'unban')}
                            disabled={!!actionLoading}
                            title="Unban user"
                            className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 flex items-center justify-center transition-colors"
                          >
                            <UserCheck size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
