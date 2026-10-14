import Link from 'next/link';
import type { PublicPerson } from '@/lib/identity';

interface Props {
  person: PublicPerson;
  /** e.g. "Partner 1" — shown when there's no name */
  fallbackTitle: string;
  className?: string;
}

/** One person's public details (already stripped of hidden fields server-side). */
export default function PersonCard({ person: p, fallbackTitle, className = '' }: Props) {
  const rows: { label: string; value?: string }[] = [
    { label: 'Gender', value: [p.gender, p.genderLabel].filter(Boolean).join(' · ') || undefined },
    { label: 'Orientation', value: p.orientation },
    { label: 'Height', value: p.height },
    { label: 'Body type', value: p.bodyType },
    { label: 'Ethnicity', value: p.ethnicity },
    { label: 'Languages', value: p.languages?.join(', ') },
    { label: 'Drinks', value: p.drinking },
    { label: 'Smokes', value: p.smoking },
  ].filter((r) => !!r.value);

  return (
    <section className={`glass rounded-2xl p-5 min-w-0 ${className}`} aria-label={p.name || fallbackTitle}>
      <div className="flex items-baseline flex-wrap gap-x-2 gap-y-0.5 mb-3">
        <h3 className="text-white font-semibold text-base break-words">{p.name || fallbackTitle}</h3>
        {p.age !== undefined && <span className="text-white/70 text-sm">{p.age}</span>}
        {p.pronouns && <span className="text-white/55 text-xs">({p.pronouns})</span>}
      </div>
      {rows.length > 0 ? (
        <dl className="space-y-2">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-3 text-sm">
              <dt className="text-white/55 flex-shrink-0">{r.label}</dt>
              <dd className="text-white/85 text-right break-words min-w-0">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-white/45 text-xs italic">No details shared yet</p>
      )}
      {p.username && (
        <Link href={`/members/${p.username}`} className="inline-block mt-3 text-xs text-[#FF4D6D] hover:underline">
          View @{p.username}&apos;s profile
        </Link>
      )}
    </section>
  );
}
