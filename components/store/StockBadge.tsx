import { LOW_STOCK_THRESHOLD } from '@/lib/store/config';

export default function StockBadge({ stock, className = '' }: { stock: number; className?: string }) {
  if (stock <= 0) {
    return <span className={`inline-flex items-center rounded-full bg-white/10 text-white/75 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}>Sold out</span>;
  }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return <span className={`inline-flex items-center rounded-full bg-[#D4AF37]/15 text-[#F5D77A] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}>Low stock</span>;
  }
  return null;
}
