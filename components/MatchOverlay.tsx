'use client';

import { useEffect, useRef } from 'react';

interface Props {
  show: boolean;
  matchedUser: { name: string; photo?: string };
  onMessage: () => void;
  onClose: () => void;
}

const HEART_POSITIONS = [5, 12, 22, 33, 44, 55, 65, 74, 83, 92];

export default function MatchOverlay({ show, matchedUser, onMessage, onClose }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (show) {
      timerRef.current = setTimeout(onClose, 8000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [show, onClose]);

  if (!show) return null;

  const initials = matchedUser.name.slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/85 backdrop-blur-md">
      <style>{`
        @keyframes heartRain {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0; }
        }
        @keyframes mergeScale {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes goldGlow {
          0%, 100% { text-shadow: 0 0 20px rgba(212,175,55,0.5); }
          50% { text-shadow: 0 0 40px rgba(212,175,55,0.9), 0 0 60px rgba(220,20,60,0.4); }
        }
        .heart-rain { animation: heartRain linear infinite; }
        .merge-scale { animation: mergeScale 0.6s ease-out forwards; }
        .gold-glow { animation: goldGlow 2s ease-in-out infinite; }
      `}</style>

      {/* Raining hearts */}
      {HEART_POSITIONS.map((left, i) => (
        <div
          key={i}
          className="heart-rain fixed top-0 text-2xl pointer-events-none select-none"
          style={{
            left: `${left}%`,
            animationDuration: `${2.5 + (i % 3) * 0.7}s`,
            animationDelay: `${(i * 0.3) % 1.5}s`,
          }}
        >
          {i % 3 === 0 ? '❤️' : i % 3 === 1 ? '💕' : '💖'}
        </div>
      ))}

      {/* Card */}
      <div className="glass rounded-3xl p-8 text-center max-w-sm w-full relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#DC143C]/20 via-transparent to-[#D4AF37]/10 pointer-events-none" />

        <div className="relative z-10">
          <div className="text-5xl mb-2">💫</div>
          <h2
            className="font-serif text-4xl font-bold mb-1 gold-glow"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #DC143C, #D4AF37)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
          >
            It&apos;s a Match!
          </h2>
          <p className="text-white/60 text-sm mb-8">
            You and <span className="text-white font-semibold">{matchedUser.name}</span> liked each other!
          </p>

          {/* Photos */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <div
              className="merge-scale w-24 h-24 rounded-full bg-gradient-to-br from-rose-900 to-red-700 flex items-center justify-center border-4 border-[#DC143C] shadow-lg shadow-[#DC143C]/30 flex-shrink-0"
            >
              <span className="text-white text-2xl font-bold font-serif">You</span>
            </div>

            <div className="text-[#DC143C]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>

            <div
              className="merge-scale w-24 h-24 rounded-full bg-gradient-to-br from-purple-900 to-violet-700 flex items-center justify-center border-4 border-[#D4AF37] shadow-lg shadow-[#D4AF37]/30 flex-shrink-0 overflow-hidden"
              style={{ animationDelay: '0.15s' }}
            >
              {matchedUser.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={matchedUser.photo} alt={matchedUser.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-xl font-bold font-serif">{initials}</span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={onMessage}
              className="w-full bg-gradient-to-r from-[#DC143C] to-[#8F0D25] hover:from-[#FF1744] hover:to-[#DC143C] text-white py-3.5 rounded-xl font-semibold transition-all hover:scale-105 active:scale-95"
            >
              Send a Message
            </button>
            <button
              onClick={onClose}
              className="w-full glass py-3 rounded-xl text-white/60 hover:text-white text-sm font-medium transition-colors border border-white/10 hover:border-white/20"
            >
              Keep Discovering
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
