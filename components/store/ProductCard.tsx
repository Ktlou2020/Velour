import Link from 'next/link';
import ProtectedImage from '@/components/ProtectedImage';
import type { ProductCardData } from '@/lib/store/catalog';
import Price from './Price';
import ProductPlaceholder from './ProductPlaceholder';
import StockBadge from './StockBadge';

export default function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const soldOut = product.stock <= 0;
  return (
    <Link
      href={`/store/p/${product.slug}`}
      className="group block rounded-2xl overflow-hidden glass hover:border-white/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#DC143C]"
    >
      <div className={`relative aspect-square overflow-hidden ${soldOut ? 'opacity-60' : ''}`}>
        {product.image ? (
          <ProtectedImage src={product.image} alt="" className="w-full h-full" loading={priority ? 'eager' : 'lazy'}
            imgClassName="w-full h-full object-cover pointer-events-none transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <ProductPlaceholder name={product.name} category={product.categoryName} />
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {product.isSample && <span className="rounded-full bg-black/60 border border-white/15 text-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Sample</span>}
          {product.compareAtCents && !soldOut && <span className="rounded-full bg-[#DC143C] text-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Sale</span>}
        </div>
        <StockBadge stock={product.stock} className="absolute bottom-2 left-2 backdrop-blur" />
      </div>
      <div className="p-3 sm:p-4">
        {product.categoryName && <p className="text-[10px] uppercase tracking-[0.18em] text-white/45 mb-1 truncate">{product.categoryName}</p>}
        <h3 className="text-white text-sm sm:text-[15px] font-medium leading-snug line-clamp-2 min-h-[2.5em]">{product.name}</h3>
        <Price cents={product.priceCents} compareAtCents={product.compareAtCents} size="sm" className="mt-2" />
      </div>
    </Link>
  );
}
