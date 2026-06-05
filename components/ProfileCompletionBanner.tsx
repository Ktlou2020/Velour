'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star, ChevronDown, ChevronUp, X, CheckCircle, Circle, Sparkles } from 'lucide-react';

interface CompletionData {
  completeness: number;
  creditsAwarded: number;
  milestone: string | null;
  missingFields: string[];
}

const FIELD_LABELS: Record<string, { label: string; href: string; hint: string }> = {
  displayName:        { label: 'Display name',        href: '/profile', hint: 'How others see you' },
  bio:                { label: 'About me / Bio',       href: '/profile', hint: 'Tell people who you are' },
  dateOfBirth:        { label: 'Date of birth',        href: '/onboarding', hint: 'Shows your age on your profile' },
  gender:             { label: 'Gender',               href: '/onboarding', hint: 'Required for matching' },
  orientation:        { label: 'Orientation',          href: '/onboarding', hint: 'Helps find the right matches' },
  relationshipStatus: { label: 'Relationship status',  href: '/onboarding', hint: 'Let others know where you stand' },
  city:               { label: 'City',                 href: '/profile', hint: 'Find people near you' },
  country:            { label: 'Country',              href: '/profile', hint: 'Location for local matching' },
  profilePhoto:       { label: 'Profile photo',        href: '/profile', hint: 'Profiles with photos get 8× more views' },
};

const MILESTONES = [
  { pct: 40,  credits: 1, label: '40%',  reward: '+1 Super Like' },
  { pct: 70,  credits: 2, label: '70%',  reward: '+2 Super Likes' },
  { pct: 100, credits: 3, label: '100%', reward: '+3 Super Likes' },
];

export default function ProfileCompletionBanner() {
  const [data, setData] = useState<CompletionData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [rewardShown, setRewardShown] = useState(false);

  useEffect(() => {
    // Only show once per session
    const key = 'velour_completion_checked';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    fetch('/api/profile/complete', { method: 'POST' })
      .then(r => r.json())
      .then((d: CompletionData) => {
        setData(d);
        if (d.completeness < 100) setExpanded(true);
        if (d.creditsAwarded > 0) setRewardShown(true);
      })
      .catch(() => {});
  }, []);

  if (dismissed || !data) return null;
  if (data.completeness >= 100 && !rewardShown) return null;

  const pct = data.completeness;
  const nextMilestone = MILESTONES.find(m => m.pct > pct);
  const ptsToNext = nextMilestone ? nextMilestone.pct - pct : 0;
  const segWidth = (pct / 100) * 100;

  return (
    <>
      {/* Reward toast */}
      {rewardShown && data.creditsAwarded > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-[slideDown_0.4s_ease-out]">
          <div className="glass border border-[#D4AF37]/40 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
              <Sparkles size={20} className="text-[#D4AF37]" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{data.milestone}</p>
              <p className="text-[#D4AF37] text-xs">+{data.creditsAwarded} Super Like{data.creditsAwarded > 1 ? 's' : ''} awarded!</p>
            </div>
            <button onClick={() => setRewardShown(false)} className="ml-2 text-white/40 hover:text-white">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Banner — skip if profile is 100% and no reward to show */}
      {pct < 100 && (
        <div className="glass border-b border-white/5 px-4 py-3">
          <div className="max-w-2xl mx-auto">
            {/* Header row */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white/70 text-xs font-medium">
                    Profile {pct}% complete
                    {nextMilestone && (
                      <span className="text-white/40 ml-1">
                        — {ptsToNext}% more for {nextMilestone.reward}
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {MILESTONES.map(m => (
                      <div key={m.pct} className={`flex items-center gap-1 text-xs ${pct >= m.pct ? 'text-[#D4AF37]' : 'text-white/20'}`}>
                        <Star size={10} className={pct >= m.pct ? 'fill-current' : ''} />
                        <span>{m.reward}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Progress bar with milestone markers */}
                <div className="relative h-2 bg-white/10 rounded-full overflow-visible">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#DC143C] to-[#D4AF37] rounded-full transition-all duration-700"
                    style={{ width: `${segWidth}%` }}
                  />
                  {MILESTONES.map(m => (
                    <div
                      key={m.pct}
                      className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 transition-colors ${pct >= m.pct ? 'bg-[#D4AF37] border-[#D4AF37]' : 'bg-[#0A0A0F] border-white/20'}`}
                      style={{ left: `calc(${m.pct}% - 6px)` }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={() => setExpanded(e => !e)}
                className="text-white/50 hover:text-white transition-colors flex-shrink-0"
                aria-label={expanded ? 'Collapse' : 'Expand'}
              >
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <button onClick={() => setDismissed(true)} className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0" aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>

            {/* Expanded checklist */}
            {expanded && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {Object.entries(FIELD_LABELS).map(([key, { label, href, hint }]) => {
                  const missing = data.missingFields.includes(key);
                  return (
                    <Link
                      key={key}
                      href={href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
                        missing
                          ? 'glass border border-white/10 hover:border-[#DC143C]/40 text-white/70 hover:text-white'
                          : 'text-white/30 cursor-default pointer-events-none'
                      }`}
                    >
                      {missing
                        ? <Circle size={14} className="text-white/30 flex-shrink-0" />
                        : <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />}
                      <span className={missing ? '' : 'line-through'}>{label}</span>
                      {missing && <span className="text-white/30 text-xs ml-auto hidden sm:block">{hint}</span>}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
