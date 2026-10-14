import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Package } from 'lucide-react';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import EmptyState from '@/components/EmptyState';
import StatusPill from '@/components/store/StatusPill';
import { STORE_NAME } from '@/lib/store/config';
import { formatDate, formatRand } from '@/lib/store/format';
import { maybeReleaseExpired } from '@/lib/store/orders';

export const metadata: Metadata = { title: 'My orders' };
export const dynamic = 'force-dynamic';

export default async function MyOrdersPage() {
  const session = await auth();
  const userId = session!.user!.id!;
  await maybeReleaseExpired();
  const orders = await db.order.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, number: true, status: true, totalCents: true, createdAt: true, items: { select: { quantity: true } } },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 sm:pt-10">
      <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-6">My orders</h1>
      {orders.length === 0 ? (
        <div className="glass rounded-3xl">
          <EmptyState icon={Package} title="No orders yet" description={`When you order from ${STORE_NAME}, you can follow it here.`} action={{ label: `Shop ${STORE_NAME}`, href: '/store' }} />
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const units = o.items.reduce((s, i) => s + i.quantity, 0);
            return (
              <li key={o.id}>
                <Link href={`/store/orders/${o.number}`} className="glass rounded-2xl p-4 sm:p-5 flex items-center gap-4 hover:border-white/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-semibold tabular-nums">{o.number}</span>
                      <StatusPill status={o.status} />
                    </div>
                    <p className="text-white/50 text-xs mt-1">{formatDate(o.createdAt)} · {units} item{units === 1 ? '' : 's'}</p>
                  </div>
                  <span className="text-white font-semibold tabular-nums">{formatRand(o.totalCents)}</span>
                  <ChevronRight size={16} className="text-white/35" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
