import { redirect } from 'next/navigation';
import { requireAdmin } from '@/auth';
import { systemChecks, type CheckStatus } from '@/lib/system-health';
import { Activity, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'System health — Unbound admin' };

const STYLE: Record<CheckStatus, { icon: typeof CheckCircle; cls: string; label: string }> = {
  ok: { icon: CheckCircle, cls: 'text-emerald-400', label: 'OK' },
  warn: { icon: AlertTriangle, cls: 'text-amber-300', label: 'Needs attention' },
  fail: { icon: XCircle, cls: 'text-red-400', label: 'Not set up' },
};

export default async function HealthPage() {
  if (!(await requireAdmin())) redirect('/members');
  const checks = await systemChecks();
  const groups = [...new Set(checks.map((c) => c.group))];
  const bad = checks.filter((c) => c.status !== 'ok').length;
  return (
    <div className="p-6 sm:p-8 max-w-4xl">
      <h1 className="text-white text-2xl font-bold font-serif flex items-center gap-2"><Activity className="text-[#FF4D6D]" size={20} /> System health</h1>
      <p className="text-white/50 text-sm mt-1 mb-6">{bad === 0 ? 'Everything is set up.' : `${bad} thing${bad === 1 ? '' : 's'} to look at.`} Checked live just now; settings are only checked for presence, never shown.</p>
      {groups.map((g) => (
        <section key={g} className="mb-6" aria-labelledby={`h-${g}`}>
          <h2 id={`h-${g}`} className="text-white/60 text-xs uppercase tracking-wider font-semibold mb-2">{g}</h2>
          <ul className="space-y-2">
            {checks.filter((c) => c.group === g).map((c) => {
              const s = STYLE[c.status];
              return (
                <li key={c.name} className="glass rounded-xl p-4" data-check={c.name} data-status={c.status}>
                  <div className="flex items-start gap-3">
                    <s.icon size={18} className={`${s.cls} shrink-0 mt-0.5`} aria-label={s.label} />
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold">{c.name}</p>
                      <p className="text-white/65 text-sm mt-0.5 break-words">{c.detail}</p>
                      {c.fix && <p className="text-white/85 text-sm mt-2"><span className="text-[#FF4D6D] font-semibold">How to fix: </span>{c.fix}</p>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
