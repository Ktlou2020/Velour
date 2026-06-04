'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Flag, ArrowLeft } from 'lucide-react';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 flex-shrink-0 bg-[#0A0A0F] border-r border-white/5 flex flex-col min-h-screen pt-4">
      <div className="px-4 mb-6">
        <p className="text-[#DC143C] font-bold text-lg font-serif">Velour</p>
        <p className="text-white/30 text-xs">Admin Panel</p>
      </div>

      <nav className="flex-1 px-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                active
                  ? 'bg-[#DC143C]/20 text-[#DC143C] font-semibold'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 pb-6">
        <Link
          href="/members"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/30 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to App
        </Link>
      </div>
    </aside>
  );
}
