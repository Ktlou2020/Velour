'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  dateOfBirth:        { label: 'Date of birth',        href: '/profile#identity', hint: 'Shows your age on your profile' },
  gender:             { label: 'Gender',               href: '/profile#identity', hint: 'Helps the right people find you — you can hide it' },
  orientation:        { label: 'Orientation',          href: '/profile#identity', hint: 'Helps find the right matches — you can hide it' },
  interestedIn:       { label: 'Who you’d like to meet', href: '/profile#identity', hint: 'We only show you people who’d like to meet you too' },
  city:               { label: 'City',                 href: '/profile', hint: 'Find people near you' },
  country:            { label: 'Country',              href: '/profile', hint: 'Location for local matching' },
  profilePhoto:       { label: 'Profile photo',        href: '/profile', hint: 'Members look for a face before saying hello' },
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
  const pathname = usePathname();

  useEffect(() => {
    // Only show once per session
    const key = 'velour_completion_checked';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    fetch('/api/profile/complete', { method: 'POST' })
      .then(r => r.json())
      .then((d: CompletionData) => {
        setData(d);
        if (d.creditsAwarded > 0) setRewardShown(true);
      })
      .catch(() => {});
  }, []);

  if (dismissed || !data) return null;
  // Full-height app screens (chat, swipe deck) have no room for an extra strip.
  const hideStrip = pathname.startsWith('/messages') || pathname.startsWith('/discover') || pathname.startsWith('/onboarding');
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
              <p className="text-white font-semibold text-sm" role="status">{data.milestone}</p>
              <p className="text-[#D4AF37] text-xs">+{data.creditsAwarded} Super Like{data.creditsAwarded > 1 ? 's' : ''} awarded!</p>
            </div>
            <button onClick={() => setRewardShown(false)} className="ml-2 text-white/60 hover:text-white" aria-label="Close">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Banner — in normal page flow directly under the fixed navbar
          (mt-16 clears the bar, -mb-16 cancels the page's own pt-16), so it
          never covers page content. Collapsed by default. */}
      {pct < 100 && !hideStrip && (
        <div className="relative z-30 mt-16 -mb-16 glass-dark border-b border-white/5 px-4 py-2.5">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <p className="text-white/85 text-xs font-medium truncate">
                    Your profile is {pct}% complete
                    {nextMilestone && (
                      <span className="text-[#D4AF37] ml-1 hidden sm:inline">· {ptsToNext}% more earns {nextMilestone.reward}</span>
                    )}
                  </p>
                  <div className="hidden md:flex items-center gap-3">
                    {MILESTONES.map(m => (
                      <span key={m.pct} className={`flex items-center gap-1 text-[11px] ${pct >= m.pct ? 'text-[#D4AF37]' : 'text-white/45'}`}>
                        <Star size={10} className={pct >= m.pct ? 'fill-current' : ''} aria-hidden="true" />
                        {m.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  className="relative h-1.5 bg-white/10 rounded-full"
                  role="progressbar"
                  aria-label="Profile completeness"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#DC143C] to-[#D4AF37] rounded-full transition-all duration-700"
                    style={{ width: `${segWidth}%` }}
                  />
                </div>
              </div>

              <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center gap-1 text-xs font-semibold text-[#FF4D6D] hover:text-white transition-colors flex-shrink-0 px-2 py-1.5 rounded-lg"
                aria-expanded={expanded}
                aria-controls="profile-checklist"
              >
                {expanded ? 'Hide' : 'Finish'}
                {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
              </button>
              <button onClick={() => setDismissed(true)} className="w-8 h-8 -mr-2 flex items-center justify-center text-white/55 hover:text-white transition-colors flex-shrink-0 rounded-lg" aria-label="Dismiss profile reminder">
                <X size={14} aria-hidden="true" />
              </button>
            </div>

            {/* Expanded checklist */}
            {expanded && (
              <div id="profile-checklist" className="mt-3 mb-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[50vh] overflow-y-auto">
                {Object.entries(FIELD_LABELS).map(([key, { label, href, hint }]) => {
                  const missing = data.missingFields.includes(key);
                  return (
                    <Link
                      key={key}
                      href={href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
                        missing
                          ? 'glass border border-white/10 hover:border-[#DC143C]/40 text-white/70 hover:text-white'
                          : 'text-white/55 cursor-default pointer-events-none'
                      }`}
                    >
                      {missing
                        ? <Circle size={14} className="text-white/55 flex-shrink-0" />
                        : <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />}
                      <span className={missing ? '' : 'line-through'}>{label}</span>
                      {missing && <span className="text-white/55 text-xs ml-auto hidden sm:block">{hint}</span>}
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
