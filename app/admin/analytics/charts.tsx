// Dependency-free, accessible charts for the admin analytics page (inline SVG).
import type { AnalyticsDay, SeriesKey } from '@/lib/admin-analytics';

function shortDay(date: string) {
  return new Date(`${date}T12:00:00+02:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' });
}

export function rands(cents: number) {
  return `R${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function delta(value: number, previous: number) {
  if (previous === 0 && value === 0) return { text: 'No activity yet', tone: 'text-white/45' };
  if (previous === 0) return { text: 'New this period', tone: 'text-emerald-300' };
  const pct = Math.round(((value - previous) / previous) * 100);
  if (pct === 0) return { text: 'Same as previous period', tone: 'text-white/45' };
  return { text: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs previous period`, tone: pct > 0 ? 'text-emerald-300' : 'text-amber-300' };
}

export function Kpi({ label, value, previous, money }: { label: string; value: number; previous?: number; money?: boolean }) {
  const d = previous === undefined ? null : delta(value, previous);
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-white/60 text-xs">{label}</p>
      <p className="text-white text-2xl font-bold tabular-nums mt-1">{money ? rands(value) : value.toLocaleString('en-ZA')}</p>
      {d && <p className={`text-[11px] mt-1 ${d.tone}`}>{d.text}</p>}
    </div>
  );
}

/** Daily column chart for one metric. */
export function DailyBars({
  title, series, metric, color, money,
}: {
  title: string;
  series: AnalyticsDay[];
  metric: SeriesKey;
  color: string;
  money?: boolean;
}) {
  const values = series.map((d) => d[metric]);
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...values);
  const W = 300, H = 96, gap = values.length > 60 ? 0.5 : values.length > 31 ? 1 : 2;
  const bw = Math.max(0.5, (W - gap * (values.length - 1)) / values.length);
  const peak = values.indexOf(Math.max(...values));
  const fmt = (v: number) => (money ? rands(v) : v.toLocaleString('en-ZA'));
  return (
    <figure className="glass rounded-2xl p-4 sm:p-5">
      <figcaption className="flex items-baseline justify-between gap-2 mb-3">
        <span className="text-white/80 text-sm font-medium">{title}</span>
        <span className="text-white text-xl font-bold tabular-nums">{fmt(total)}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H + 14}`}
        className="w-full h-28"
        role="img"
        aria-label={total === 0 ? `${title}: none in this period` : `${title}: ${fmt(total)} in total, busiest ${shortDay(series[peak].date)} with ${fmt(values[peak])}`}
      >
        <line x1="0" x2={W} y1={H} y2={H} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        {values.map((v, i) => {
          const h = v === 0 ? 0 : Math.max(3, (v / max) * (H - 6));
          const x = i * (bw + gap);
          return (
            <g key={series[i].date}>
              <rect x={x} y={0} width={bw + gap} height={H} fill="transparent">
                <title>{`${shortDay(series[i].date)}: ${fmt(v)}`}</title>
              </rect>
              {h > 0 && <rect x={x} y={H - h} width={bw} height={h} rx={Math.min(2, bw / 2)} fill={color} opacity={i === peak ? 1 : 0.75} pointerEvents="none" />}
            </g>
          );
        })}
        <text x="0" y={H + 12} fill="rgba(255,255,255,0.45)" fontSize="9">{shortDay(series[0].date)}</text>
        <text x={W} y={H + 12} fill="rgba(255,255,255,0.45)" fontSize="9" textAnchor="end">Today</text>
      </svg>
      <p className="text-white/45 text-[11px] mt-1">
        {total === 0 ? 'Nothing in this period' : <>Busiest day: <span className="text-white/70">{fmt(values[peak])}</span> on {shortDay(series[peak].date)}</>}
      </p>
    </figure>
  );
}

/** Horizontal bars with values (and optional share of total). */
export function HBars({ title, rows, color, empty, showShare }: { title: string; rows: { label: string; count: number }[]; color: string; empty: string; showShare?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((t, r) => t + r.count, 0);
  return (
    <figure className="glass rounded-2xl p-4 sm:p-5">
      <figcaption className="text-white/80 text-sm font-medium mb-3">{title}</figcaption>
      {rows.length === 0 || total === 0 ? (
        <p className="text-white/50 text-sm">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-2 text-xs">
              <span className="truncate text-white/70" title={r.label}>{r.label}</span>
              <span className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden" aria-hidden="true">
                <span className="block h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: color }} />
              </span>
              <span className="text-right text-white/80 tabular-nums">
                {r.count.toLocaleString('en-ZA')}
                {showShare && <span className="text-white/40"> {Math.round((r.count / total) * 100)}%</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

/** Conversion funnel: each step as a share of the first. */
export function Funnel({ steps }: { steps: { label: string; count: number }[] }) {
  const top = Math.max(1, steps[0]?.count ?? 0);
  return (
    <figure className="glass rounded-2xl p-4 sm:p-5">
      <figcaption className="text-white/80 text-sm font-medium mb-1">New-member funnel</figcaption>
      <p className="text-white/45 text-[11px] mb-3">Members who joined in this period and what they have done since</p>
      {steps[0]?.count === 0 ? (
        <p className="text-white/50 text-sm">No sign-ups in this period</p>
      ) : (
        <ol className="space-y-2.5">
          {steps.map((s, i) => {
            const pct = Math.round((s.count / top) * 100);
            const prev = i > 0 ? steps[i - 1].count : null;
            const stepPct = prev ? Math.round((s.count / prev) * 100) : null;
            return (
              <li key={s.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/75">{s.label}</span>
                  <span className="text-white tabular-nums">
                    {s.count.toLocaleString('en-ZA')} <span className="text-white/45">· {pct}%{stepPct !== null ? ` (${stepPct}% of previous)` : ''}</span>
                  </span>
                </div>
                <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden" aria-hidden="true">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#DC143C] to-[#D4AF37]" style={{ width: `${Math.max(pct, s.count > 0 ? 2 : 0)}%` }} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </figure>
  );
}
