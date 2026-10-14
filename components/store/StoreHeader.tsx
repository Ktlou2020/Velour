'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Package, Search, ShoppingBag } from 'lucide-react';
import { cartCount, useCart } from '@/lib/store/cart-client';
import { STORE_NAME } from '@/lib/store/config';
import { useStore } from './StoreProvider';

/** Store sub-navigation under the main Navbar: name, search, orders, cart. */
export default function StoreHeader() {
  const { openDrawer } = useStore();
  const items = useCart();
  const count = cartCount(items);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  useEffect(() => { setQ(params.get('q') ?? ''); }, [params]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    // Search within the current category page, otherwise the whole store.
    const base = pathname.startsWith('/store/c/') ? pathname : '/store';
    router.push(term ? `${base}?q=${encodeURIComponent(term)}#results` : base);
  }

  return (
    <div className="sticky top-16 z-40 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
        <Link href="/store" className="font-serif text-lg sm:text-xl font-bold text-white tracking-wide shrink-0">
          {STORE_NAME}
        </Link>
        <form onSubmit={submit} role="search" className="flex-1 min-w-0 max-w-md ml-auto sm:ml-4">
          <label htmlFor="store-search" className="sr-only">Search {STORE_NAME}</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" aria-hidden="true" />
            <input id="store-search" type="search" value={q} onChange={(e) => setQ(e.target.value.slice(0, 80))} placeholder="Search products"
              className="w-full bg-white/5 border border-white/10 focus:border-[#DC143C] focus:outline-none rounded-xl pl-9 pr-3 h-9 text-sm text-white placeholder:text-white/40" />
          </div>
        </form>
        <Link href="/store/orders" className="hidden sm:inline-flex items-center gap-1.5 text-sm text-white/65 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/5" aria-label="My orders">
          <Package size={16} aria-hidden="true" /><span>Orders</span>
        </Link>
        <Link href="/store/orders" className="sm:hidden p-2 text-white/65 hover:text-white rounded-lg" aria-label="My orders">
          <Package size={18} aria-hidden="true" />
        </Link>
        <button type="button" onClick={openDrawer} className="relative p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/5"
          aria-label={count ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart, empty'}>
          <ShoppingBag size={19} aria-hidden="true" />
          {count > 0 && (
            <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#DC143C] text-white text-[10px] font-bold flex items-center justify-center">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
