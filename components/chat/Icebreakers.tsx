'use client';

import { Sparkles } from 'lucide-react';

interface Props {
  suggestions: string[];
  name: string;
  onPick: (text: string) => void;
}

export default function Icebreakers({ suggestions, name, onPick }: Props) {
  if (suggestions.length === 0) return null;
  return (
    <div className="max-w-md mx-auto w-full py-6">
      <div className="flex items-center justify-center gap-1.5 text-[#D4AF37] text-xs font-semibold uppercase tracking-wider mb-3">
        <Sparkles size={13} />
        Break the ice with {name}
      </div>
      <div className="flex flex-col gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="glass text-left text-sm text-white/80 hover:text-white px-4 py-2.5 rounded-xl border border-white/5 hover:border-[#D4AF37]/40 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
