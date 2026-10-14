import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PackageOpen } from 'lucide-react';
import { db } from '@/lib/db';
import EmptyState from '@/components/EmptyState';
import CategoryChips from '@/components/store/CategoryChips';
import FilterBar from '@/components/store/FilterBar';
import Pagination, { pageHref } from '@/components/store/Pagination';
import ProductGrid from '@/components/store/ProductGrid';
import { listCategories, parseSearchParams, searchProducts } from '@/lib/store/catalog';
import { maybeReleaseExpired } from '@/lib/store/orders';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

async function getCategory(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  return db.productCategory.findUnique({ where: { slug }, select: { id: true, name: true, slug: true, description: true } });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await getCategory((await params).slug);
  return { title: c?.name ?? 'Category' };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const category = await getCategory(slug);
  if (!category) notFound();
  await maybeReleaseExpired();
  const filters = { ...parseSearchParams(sp), category: category.slug };
  const [categories, results] = await Promise.all([listCategories(), searchProducts(filters)]);
  const path = `/store/c/${category.slug}`;

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 sm:pt-8">
      <CategoryChips categories={categories} active={category.slug} />
      <header className="mt-8 mb-6">
        <p className="eyebrow text-[#D4AF37] mb-2">Category</p>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white">{category.name}</h1>
        {category.description && <p className="text-white/60 mt-2 max-w-2xl">{category.description}</p>}
      </header>
      <FilterBar action={path} total={results.total}
        values={{ q: filters.q, min: filters.min, max: filters.max, inStock: filters.inStock, sort: filters.sort }} />
      {results.items.length ? (
        <>
          <ProductGrid products={results.items} />
          <Pagination page={results.page} pages={results.pages} hrefFor={(p) => pageHref(path, sp, p)} />
        </>
      ) : (
        <EmptyState compact icon={PackageOpen} title="Nothing here yet" description="Try another category, or clear the filters." action={{ label: 'Browse everything', href: '/store' }} />
      )}
    </div>
  );
}
