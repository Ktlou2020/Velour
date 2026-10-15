import Link from 'next/link';
import { ArrowRight, PackageOpen, ShieldCheck, Sparkles, Truck } from 'lucide-react';
import { auth } from '@/auth';
import EmptyState from '@/components/EmptyState';
import CategoryChips from '@/components/store/CategoryChips';
import FilterBar from '@/components/store/FilterBar';
import Pagination, { pageHref } from '@/components/store/Pagination';
import ProductGrid, { ProductRow } from '@/components/store/ProductGrid';
import { featuredProducts, hasActiveFilters, listCategories, newestProducts, parseSearchParams, searchProducts } from '@/lib/store/catalog';
import { STORE_NAME, STORE_TAGLINE } from '@/lib/store/config';
import { formatRand } from '@/lib/store/format';
import { maybeReleaseExpired } from '@/lib/store/orders';
import { storeSettings } from '@/lib/store/settings';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

export default async function StoreHome({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const params = parseSearchParams(sp);
  await maybeReleaseExpired();
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'ADMIN';
  const filtering = hasActiveFilters(params) || !!params.category;

  const [categories, results, featured, newest] = await Promise.all([
    listCategories(),
    searchProducts(params),
    filtering ? Promise.resolve([]) : featuredProducts(4),
    filtering ? Promise.resolve([]) : newestProducts(8),
  ]);
  const settings = storeSettings();
  const featuredIds = new Set(featured.map((p) => p.id));
  const newIn = newest.filter((p) => !featuredIds.has(p.id)).slice(0, 4);
  const storeEmpty = !filtering && results.total === 0;

  return (
    <>
      {!filtering && (
        <section className="relative overflow-hidden border-b border-white/5">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(220,20,60,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(212,175,55,0.10),transparent_50%)]" />
          <div className="relative max-w-6xl mx-auto px-4 py-12 sm:py-20">
            <p className="eyebrow text-[#D4AF37] mb-3">The Unbound store · 18+</p>
            <h1 className="font-serif text-4xl sm:text-6xl font-bold text-white tracking-tight">{STORE_NAME}</h1>
            <p className="text-white/70 text-base sm:text-lg mt-3 max-w-xl leading-relaxed">{STORE_TAGLINE}</p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 mt-6 text-sm text-white/60">
              <li className="flex items-center gap-2"><ShieldCheck size={15} className="text-[#D4AF37]" aria-hidden="true" />Plain, unbranded packaging</li>
              <li className="flex items-center gap-2"><Truck size={15} className="text-[#D4AF37]" aria-hidden="true" />
                {settings.freeShippingOverCents > 0 ? `Free delivery over ${formatRand(settings.freeShippingOverCents)}` : `Delivery ${formatRand(settings.shippingCents)}`}
              </li>
              <li className="flex items-center gap-2"><Sparkles size={15} className="text-[#D4AF37]" aria-hidden="true" />Body-safe, quality-checked</li>
            </ul>
          </div>
        </section>
      )}

      <div className="max-w-6xl mx-auto px-4 pt-6 sm:pt-8">
        <CategoryChips categories={categories} active={params.category ?? null} />

        {storeEmpty ? (
          <EmptyState icon={PackageOpen} title={`${STORE_NAME} is being stocked`}
            description="New arrivals are on their way. Check back soon."
            action={isAdmin ? { label: 'Set up the store', href: '/admin/store' } : { label: 'Back to Unbound', href: '/members' }} />
        ) : (
          <>
            {featured.length > 0 && (
              <section className="mt-8" aria-labelledby="featured-h">
                <div className="flex items-end justify-between mb-4">
                  <h2 id="featured-h" className="font-serif text-2xl font-bold text-white">Featured</h2>
                </div>
                <ProductRow products={featured} />
              </section>
            )}
            {newIn.length > 0 && (
              <section className="mt-10" aria-labelledby="new-h">
                <div className="flex items-end justify-between mb-4">
                  <h2 id="new-h" className="font-serif text-2xl font-bold text-white">New in</h2>
                  <Link href="/store?sort=newest#results" className="text-sm text-white/60 hover:text-white inline-flex items-center gap-1">See all <ArrowRight size={14} aria-hidden="true" /></Link>
                </div>
                <ProductRow products={newIn} />
              </section>
            )}

            <section id="results" className="mt-10 scroll-mt-32">
              {filtering
                ? <h1 className="font-serif text-3xl font-bold text-white mt-6 mb-4">{params.q ? 'Search results' : 'All products'}</h1>
                : <h2 className="font-serif text-2xl font-bold text-white mb-4">Shop all</h2>}
              <FilterBar action="/store" categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} total={results.total}
                values={{ q: params.q, category: params.category, min: params.min, max: params.max, inStock: params.inStock, sort: params.sort }} />
              {results.items.length ? (
                <>
                  <ProductGrid products={results.items} />
                  <Pagination page={results.page} pages={results.pages} hrefFor={(p) => pageHref('/store', sp, p)} />
                </>
              ) : (
                <EmptyState compact icon={PackageOpen} title="Nothing matches" description="Try a different search or clear the filters." action={{ label: 'Clear filters', href: '/store' }} />
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
