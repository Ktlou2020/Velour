'use client';

import { useState } from 'react';
import { Flag, CheckCircle, Ban } from 'lucide-react';

interface Report {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  data: unknown;
  createdAt: Date | string;
  user: { id: string; username: string };
}

interface Props {
  reports: Report[];
}

export default function AdminReportsClient({ reports: initialReports }: Props) {
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [loading, setLoading] = useState<string | null>(null);

  async function resolveReport(reportId: string) {
    setLoading(`resolve-${reportId}`);
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: reportId }),
      });
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, isRead: true } : r))
      );
    } finally {
      setLoading(null);
    }
  }

  async function banUser(userId: string, reportId: string) {
    setLoading(`ban-${reportId}`);
    try {
      await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'ban' }),
      });
      // Also resolve the report
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: reportId }),
      });
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, isRead: true } : r))
      );
    } finally {
      setLoading(null);
    }
  }

  const pending = reports.filter((r) => !r.isRead);
  const resolved = reports.filter((r) => r.isRead);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold font-serif flex items-center gap-2">
          <Flag className="text-orange-400" size={20} />
          Reports
        </h1>
        <p className="text-white/40 text-sm mt-1">
          {pending.length} pending · {resolved.length} resolved
        </p>
      </div>

      <div className="space-y-3 mb-8">
        <h2 className="text-white/60 text-xs uppercase tracking-wider font-semibold">Pending</h2>
        {pending.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <CheckCircle className="text-emerald-400 mx-auto mb-2" size={28} />
            <p className="text-white/40">No pending reports</p>
          </div>
        ) : (
          pending.map((r) => {
            const data = r.data as { reportedUserId?: string; reportedUsername?: string; reason?: string } | null;
            return (
              <div key={r.id} className="glass rounded-2xl p-5 border border-orange-500/20">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">REPORT</span>
                      <span className="text-white/30 text-xs">{new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-white text-sm">
                      Reporter: <span className="text-[#DC143C] font-medium">@{r.user.username}</span>
                    </p>
                    {data?.reportedUsername && (
                      <p className="text-white/60 text-sm mt-0.5">
                        Reported user: <span className="text-white font-medium">@{data.reportedUsername}</span>
                      </p>
                    )}
                    {data?.reason && (
                      <p className="text-white/50 text-sm mt-1 italic">&ldquo;{data.reason}&rdquo;</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => resolveReport(r.id)}
                      disabled={!!loading}
                      className="flex items-center gap-1.5 text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <CheckCircle size={12} />
                      Resolve
                    </button>
                    {data?.reportedUserId && (
                      <button
                        onClick={() => banUser(data.reportedUserId!, r.id)}
                        disabled={!!loading}
                        className="flex items-center gap-1.5 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Ban size={12} />
                        Ban User
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {resolved.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-white/60 text-xs uppercase tracking-wider font-semibold">Resolved</h2>
          {resolved.map((r) => {
            const data = r.data as { reportedUsername?: string; reason?: string } | null;
            return (
              <div key={r.id} className="glass rounded-2xl p-4 opacity-50">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="text-emerald-400" size={12} />
                  <span className="text-xs text-white/30">Resolved</span>
                  <span className="text-white/20 text-xs">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-white/50 text-sm">
                  @{r.user.username} reported {data?.reportedUsername ? `@${data.reportedUsername}` : 'a user'}
                </p>
                {data?.reason && (
                  <p className="text-white/30 text-xs mt-0.5 italic">{data.reason}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
