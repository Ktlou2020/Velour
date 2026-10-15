import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Package, RotateCcw, ShieldCheck } from 'lucide-react';
import AddToCart from '@/components/store/AddToCart';
import Price from '@/components/store/Price';
import ProductGallery from '@/components/store/ProductGallery';
import ProductGrid from '@/components/store/ProductGrid';
import StockBadge from '@/components/store/StockBadge';
import { getProductBySlug, relatedProducts, thumbOf } from '@/lib/store/catalog';
import { LOW_STOCK_THRESHOLD, SAMPLE_TAG, STORE_NAME, STORE_TERMS_HREF } from '@/lib/store/config';
import { maybeReleaseExpired } from '@/lib/store/orders';
import { storeSettings } from '@/lib/store/settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getProductBySlug((await params).slug);
  return { title: p?.name ?? 'Product' };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await maybeReleaseExpired();
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const related = await relatedProducts({ id: product.id, categoryId: product.categoryId, tags: product.tags });
  const { discreetSender } = storeSettings();
  const isSample = product.tags.includes(SAMPLE_TAG);
  const compareAt = product.compareAtCents && product.compareAtCents > product.priceCents ? product.compareAtCents : null;

  return (
    <div className="max-w-6xl mx-auto px-4 pt-5 sm:pt-8">
      <nav aria-label="Breadcrumb" className="text-xs text-white/50 mb-5">
        <ol className="flex items-center gap-1 flex-wrap">
          <li><Link href="/store" className="hover:text-white">{STORE_NAME}</Link></li>
          {product.category && (
            <>
              <li aria-hidden="true"><ChevronRight size={12} /></li>
              <li><Link href={`/store/c/${product.category.slug}`} className="hover:text-white">{product.category.name}</Link></li>
            </>
          )}
          <li aria-hidden="true"><ChevronRight size={12} /></li>
          <li aria-current="page" className="text-white/70 truncate max-w-[12rem]">{product.name}</li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:gap-12 md:grid-cols-2">
        <ProductGallery images={product.images} name={product.name} category={product.category?.name ?? null} />

        <div>
          {isSample && <p className="inline-block mb-3 rounded-full border border-white/15 bg-white/5 text-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">Sample product</p>}
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white leading-tight">{product.name}</h1>
          <Price cents={product.priceCents} compareAtCents={compareAt} size="lg" className="mt-4" />
          <div className="mt-3 flex items-center gap-2 text-sm">
            <StockBadge stock={product.stock} />
            {product.stock > LOW_STOCK_THRESHOLD && <span className="text-emerald-300/90">In stock</span>}
            {product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD && <span className="text-white/60">Only {product.stock} left</span>}
          </div>

          <div className="mt-6">
            <AddToCart product={{ id: product.id, slug: product.slug, name: product.name, image: thumbOf(product.images[0]), priceCents: product.priceCents, stock: product.stock }} />
          </div>

          <ul className="mt-7 space-y-3">
            <li className="flex gap-3 glass rounded-xl p-3.5">
              <Package size={18} className="text-[#D4AF37] shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-white/75 leading-relaxed"><span className="text-white font-medium">Discreet delivery.</span> Ships in plain packaging, sender name “{discreetSender}”. Nothing on the outside says what’s inside.</p>
            </li>
            <li className="flex gap-3 glass rounded-xl p-3.5">
              <RotateCcw size={18} className="text-[#D4AF37] shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-white/75 leading-relaxed"><span className="text-white font-medium">Returns.</span> For hygiene reasons intimate products can be returned only unopened and sealed. Defective items are covered for 6 months. <Link href={STORE_TERMS_HREF} className="text-[#FF4D6D] hover:underline">Store terms</Link></p>
            </li>
            <li className="flex gap-3 glass rounded-xl p-3.5">
              <ShieldCheck size={18} className="text-[#D4AF37] shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-white/75 leading-relaxed"><span className="text-white font-medium">Secure checkout</span> — we never see your card details. Prices include 15% VAT.</p>
            </li>
          </ul>

          {product.description && (
            <section className="mt-8" aria-labelledby="desc-h">
              <h2 id="desc-h" className="text-white font-semibold mb-2">Description</h2>
              {/* Plain text, rendered as text (React escapes it); line breaks preserved. */}
              <div className="text-white/75 text-[15px] leading-relaxed whitespace-pre-line break-words">{product.description}</div>
            </section>
          )}
          {(product.sku || product.weightGrams) && (
            <dl className="mt-6 grid grid-cols-2 gap-y-1 text-xs text-white/50 max-w-xs">
              {product.sku && (<><dt>SKU</dt><dd className="text-white/70">{product.sku}</dd></>)}
              {product.weightGrams && (<><dt>Weight</dt><dd className="text-white/70">{product.weightGrams} g</dd></>)}
            </dl>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-14" aria-labelledby="related-h">
          <h2 id="related-h" className="font-serif text-2xl font-bold text-white mb-4">You may also like</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
