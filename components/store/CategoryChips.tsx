import Link from 'next/link';
import type { CategoryData } from '@/lib/store/catalog';

export default function CategoryChips({ categories, active }: { categories: CategoryData[]; active?: string | null }) {
  if (!categories.length) return null;
  return (
    <nav aria-label="Categories" className="-mx-4 px-4 overflow-x-auto [scrollbar-width:none]">
      <ul className="flex gap-2 w-max">
        <li>
          <Link href="/store" aria-current={!active ? 'page' : undefined}
            className={`inline-flex items-center h-9 px-4 rounded-full text-sm border transition-colors ${!active ? 'bg-white text-black border-white' : 'border-white/12 text-white/70 hover:text-white hover:border-white/30'}`}>
            All
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.id}>
            <Link href={`/store/c/${c.slug}`} aria-current={active === c.slug ? 'page' : undefined}
              className={`inline-flex items-center h-9 px-4 rounded-full text-sm border whitespace-nowrap transition-colors ${active === c.slug ? 'bg-white text-black border-white' : 'border-white/12 text-white/70 hover:text-white hover:border-white/30'}`}>
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
