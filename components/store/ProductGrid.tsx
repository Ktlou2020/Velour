import type { ProductCardData } from '@/lib/store/catalog';
import ProductCard from './ProductCard';

export default function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
      {products.map((p, i) => (
        <li key={p.id}><ProductCard product={p} priority={i < 4} /></li>
      ))}
    </ul>
  );
}

/** Horizontal scroller on phones, grid on larger screens. */
export function ProductRow({ products }: { products: ProductCardData[] }) {
  return (
    <ul className="flex md:grid md:grid-cols-4 gap-3 sm:gap-5 overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 pb-2 [scrollbar-width:none]">
      {products.map((p) => (
        <li key={p.id} className="snap-start shrink-0 w-[44%] sm:w-[30%] md:w-auto"><ProductCard product={p} /></li>
      ))}
    </ul>
  );
}
