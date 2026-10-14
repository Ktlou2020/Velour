import Link from 'next/link';

export default function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-center gap-3 mt-8">
      {page > 1 ? <Link href={hrefFor(page - 1)} className="glass px-4 py-2 rounded-xl text-sm text-white/80 hover:text-white">Previous</Link> : <span className="px-4 py-2 text-sm text-white/25">Previous</span>}
      <span className="text-white/55 text-sm tabular-nums">Page {page} of {pages}</span>
      {page < pages ? <Link href={hrefFor(page + 1)} className="glass px-4 py-2 rounded-xl text-sm text-white/80 hover:text-white">Next</Link> : <span className="px-4 py-2 text-sm text-white/25">Next</span>}
    </nav>
  );
}

/** Build "/path?…&page=n" from the current params. */
export function pageHref(path: string, sp: Record<string, string | string[] | undefined>, page: number): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'page' || v === undefined) continue;
    const val = Array.isArray(v) ? v[0] : v;
    if (val) u.set(k, val);
  }
  if (page > 1) u.set('page', String(page));
  const s = u.toString();
  return s ? `${path}?${s}` : path;
}
