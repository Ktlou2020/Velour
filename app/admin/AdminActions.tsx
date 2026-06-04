'use client';

import { useState } from 'react';

interface Props {
  userId: string;
  isVerified: boolean;
  isActive: boolean;
}

export default function AdminActions({ userId, isVerified, isActive }: Props) {
  const [loading, setLoading] = useState(false);

  async function doAction(action: 'ban' | 'unban' | 'verify' | 'promote') {
    if (loading) return;
    setLoading(true);
    try {
      await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {!isVerified && (
        <button
          onClick={() => doAction('verify')}
          disabled={loading}
          className="text-xs bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-2 py-1 rounded-lg transition-colors"
        >
          Verify
        </button>
      )}
      {isActive ? (
        <button
          onClick={() => doAction('ban')}
          disabled={loading}
          className="text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 px-2 py-1 rounded-lg transition-colors"
        >
          Ban
        </button>
      ) : (
        <button
          onClick={() => doAction('unban')}
          disabled={loading}
          className="text-xs bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-2 py-1 rounded-lg transition-colors"
        >
          Unban
        </button>
      )}
    </div>
  );
}
