'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Flag, ArrowLeft, Star, Store, Boxes, Tags, ReceiptText } from 'lucide-react';
import { STORE_NAME } from '@/lib/store/config';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
  { href: '/admin/reviews', label: 'Reviews', icon: Star },
  { href: '/admin/store', label: STORE_NAME, icon: Store },
  { href: '/admin/store/products', label: 'Products', icon: Boxes },
  { href: '/admin/store/categories', label: 'Categories', icon: Tags },
  { href: '/admin/store/orders', label: 'Store orders', icon: ReceiptText },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-14 md:w-56 flex-shrink-0 bg-[#0A0A0F] border-r border-white/5 flex flex-col min-h-screen pt-4">
      <div className="px-4 mb-6 hidden md:block">
        <p className="text-[#DC143C] font-bold text-lg font-serif">Hush</p>
        <p className="text-white/30 text-xs">Admin Panel</p>
      </div>

      <nav className="flex-1 px-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href.startsWith('/admin/store/') && pathname.startsWith(href + '/'));
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                active
                  ? 'bg-[#DC143C]/20 text-[#DC143C] font-semibold'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} className="flex-shrink-0" aria-hidden="true" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-2 pb-6">
        <Link
          href="/members"
          aria-label="Back to App"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/30 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft size={16} className="flex-shrink-0" aria-hidden="true" />
          <span className="hidden md:inline">Back to App</span>
        </Link>
      </div>
    </aside>
  );
}
