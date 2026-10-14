// Dependency-free, accessible charts for /insights (inline SVG + CSS).
import type { InsightDay } from '@/app/api/insights/data';

function shortDay(date: string) {
  return new Date(`${date}T12:00:00+02:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' });
}

/** 30-day column chart for one metric. Single series → the title names it; no legend. */
export function DailyBars({
  title, series, metric, color, total,
}: {
  title: string;
  series: InsightDay[];
  metric: keyof Omit<InsightDay, 'date'>;
  color: string;
  total: number;
}) {
  const values = series.map((d) => d[metric]);
  const max = Math.max(1, ...values);
  const W = 300, H = 96, gap = 2;
  const bw = (W - gap * (values.length - 1)) / values.length;
  const peak = values.indexOf(Math.max(...values));
  const id = `chart-${metric}`;
  return (
    <figure className="glass rounded-2xl p-4 sm:p-5" aria-labelledby={`${id}-t`}>
      <figcaption className="flex items-baseline justify-between gap-2 mb-3">
        <span id={`${id}-t`} className="text-white/80 text-sm font-medium">{title}</span>
        <span className="text-white text-xl font-bold tabular-nums">{total.toLocaleString('en-ZA')}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full h-28" role="img" aria-label={total === 0 ? `${title}: none in the last ${values.length} days` : `${title}: ${total} over the last ${values.length} days, busiest ${shortDay(series[peak].date)} with ${values[peak]}`}>
        <line x1="0" x2={W} y1={H} y2={H} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        {values.map((v, i) => {
          const h = v === 0 ? 0 : Math.max(3, (v / max) * (H - 6));
          return (
            <g key={series[i].date}>
              {/* Hit target taller than the mark */}
              <rect x={i * (bw + gap)} y={0} width={bw} height={H} fill="transparent">
                <title>{`${shortDay(series[i].date)}: ${v}`}</title>
              </rect>
              {h > 0 && (
                <rect x={i * (bw + gap)} y={H - h} width={bw} height={h} rx={Math.min(2, bw / 2)} fill={color} opacity={i === peak ? 1 : 0.75} pointerEvents="none" />
              )}
            </g>
          );
        })}
        <text x="0" y={H + 12} fill="rgba(255,255,255,0.45)" fontSize="9">{shortDay(series[0].date)}</text>
        <text x={W} y={H + 12} fill="rgba(255,255,255,0.45)" fontSize="9" textAnchor="end">Today</text>
      </svg>
      <p className="text-white/45 text-[11px] mt-1">
        {total === 0
          ? 'Nothing yet this month'
          : <>Busiest day: <span className="text-white/70">{values[peak]}</span> on {shortDay(series[peak].date)}</>}
      </p>
    </figure>
  );
}

/** Horizontal bars with the value printed beside each bar. */
export function HBars({ title, rows, color, empty }: { title: string; rows: { label: string; count: number }[]; color: string; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const best = rows.reduce((b, r, i) => (r.count > rows[b].count ? i : b), 0);
  return (
    <figure className="glass rounded-2xl p-4 sm:p-5">
      <figcaption className="text-white/80 text-sm font-medium mb-3">{title}</figcaption>
      {rows.every((r) => r.count === 0) ? (
        <p className="text-white/50 text-sm">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.label} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2 text-xs">
              <span className={`truncate ${i === best ? 'text-white' : 'text-white/60'}`}>{r.label}</span>
              <span className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden" aria-hidden="true">
                <span className="block h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: color, opacity: i === best ? 1 : 0.7 }} />
              </span>
              <span className="text-right text-white/80 tabular-nums">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

export function StatTile({ label, value, previous }: { label: string; value: number; previous: number }) {
  const diff = value - previous;
  const pct = previous > 0 ? Math.round((diff / previous) * 100) : null;
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-white/60 text-xs">{label}</p>
      <p className="text-white text-2xl sm:text-3xl font-bold tabular-nums mt-1">{value.toLocaleString('en-ZA')}</p>
      <p className={`text-[11px] mt-1 ${diff > 0 ? 'text-emerald-300' : diff < 0 ? 'text-white/50' : 'text-white/45'}`}>
        {previous === 0 && value === 0 ? 'No activity yet'
          : pct === null ? 'New this month'
          : diff === 0 ? 'Same as the 30 days before'
          : `${diff > 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs the 30 days before`}
      </p>
    </div>
  );
}
