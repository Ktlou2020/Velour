'use client';

import { useState } from 'react';

interface Props {
  userId: string;
  isVerified: boolean;
  isActive: boolean;
  currentTier?: string;
}

export default function AdminActions({ userId, isVerified, isActive, currentTier }: Props) {
  const [loading, setLoading] = useState(false);
  const [showTierMenu, setShowTierMenu] = useState(false);

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

  async function setTier(tier: 'FREE' | 'GOLD' | 'PLATINUM') {
    if (loading) return;
    setLoading(true);
    setShowTierMenu(false);
    try {
      await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'setTier', tier }),
      });
      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  const tierColor =
    currentTier === 'PLATINUM' ? 'text-purple-400 border-purple-500/40' :
    currentTier === 'GOLD' ? 'text-[#D4AF37] border-[#D4AF37]/40' :
    'text-white/40 border-white/20';

  return (
    <div className="flex items-center gap-1 flex-wrap">
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

      {/* Tier upgrade */}
      <div className="relative">
        <button
          onClick={() => setShowTierMenu(!showTierMenu)}
          disabled={loading}
          className={`text-xs border px-2 py-1 rounded-lg transition-colors hover:bg-white/5 ${tierColor}`}
        >
          {currentTier ?? 'FREE'} ▾
        </button>
        {showTierMenu && (
          <div className="absolute right-0 top-full mt-1 glass-dark border border-white/10 rounded-xl py-1 z-50 w-28 shadow-xl">
            {(['FREE', 'GOLD', 'PLATINUM'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-white/5 ${
                  t === 'PLATINUM' ? 'text-purple-400' :
                  t === 'GOLD' ? 'text-[#D4AF37]' :
                  'text-white/50'
                } ${currentTier === t ? 'font-bold' : ''}`}
              >
                {t === currentTier ? `✓ ${t}` : t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
