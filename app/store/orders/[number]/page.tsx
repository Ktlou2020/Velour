import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Package } from 'lucide-react';
import { auth } from '@/auth';
import ProtectedImage from '@/components/ProtectedImage';
import OrderTimeline from '@/components/store/OrderTimeline';
import PayNowButton from '@/components/store/PayNowButton';
import ProductPlaceholder from '@/components/store/ProductPlaceholder';
import StatusPill from '@/components/store/StatusPill';
import { payfastConfig } from '@/lib/payfast';
import { STORE_TERMS_HREF, SUPPORT_EMAIL } from '@/lib/store/config';
import { formatDateTime, formatRand } from '@/lib/store/format';
import { maybeReleaseExpired, minutesLeftToPay } from '@/lib/store/orders';
import { trackingLink } from '@/lib/store/notify';
import { storeSettings } from '@/lib/store/settings';
import { getMyOrder } from '@/lib/store/user-orders';
import { thumbOf } from '@/lib/store/catalog';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  return { title: `Order ${(await params).number}` };
}

export default async function OrderDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const session = await auth();
  await maybeReleaseExpired();
  const order = await getMyOrder(session!.user!.id!, decodeURIComponent(number));
  if (!order) notFound();
  const minutesLeft = order.status === 'PENDING_PAYMENT' ? minutesLeftToPay(order.createdAt) : 0;
  const track = order.status === 'SHIPPED' || order.status === 'DELIVERED' ? trackingLink(order.courier, order.trackingNumber) : null;
  const trackingIsUrl = !!order.trackingNumber && /^https:\/\//i.test(order.trackingNumber);
  const { discreetSender } = storeSettings();

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 sm:pt-10">
      <Link href="/store/orders" className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-white mb-4"><ArrowLeft size={14} aria-hidden="true" />My orders</Link>
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h1 className="font-serif text-3xl font-bold text-white tabular-nums">Order {order.number}</h1>
        <StatusPill status={order.status} />
      </div>
      <p className="text-white/50 text-sm mb-6">Placed {formatDateTime(order.createdAt)}</p>

      <section className="glass rounded-2xl p-5 mb-5" aria-label="Status">
        <OrderTimeline status={order.status} createdAt={order.createdAt} paidAt={order.paidAt} shippedAt={order.shippedAt} deliveredAt={order.deliveredAt} cancelledAt={order.cancelledAt} />
        {order.status === 'PENDING_PAYMENT' && (
          <div className="mt-5 pt-5 border-t border-white/10">
            {minutesLeft > 0 && payfastConfig() ? (
              <>
                <p className="text-white/70 text-sm mb-3">We haven’t received payment for this order yet.</p>
                <PayNowButton number={order.number} minutesLeft={minutesLeft} />
              </>
            ) : (
              <p className="text-white/60 text-sm">The reservation has expired — this order will be cancelled shortly. You haven’t been charged.</p>
            )}
          </div>
        )}
        {(order.status === 'SHIPPED' || order.status === 'DELIVERED') && order.courier && (
          <div className="mt-5 pt-5 border-t border-white/10 text-sm">
            <p className="text-white/60">Courier: <span className="text-white">{order.courier}</span></p>
            {order.trackingNumber && !trackingIsUrl && (
              <p className="text-white/60 mt-1 flex items-center gap-1.5">Tracking number: <span className="text-white font-mono select-all">{order.trackingNumber}</span></p>
            )}
            {track && (
              <a href={track} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-3 text-[#FF4D6D] hover:underline">
                {trackingIsUrl ? 'Track your parcel' : `Track on ${order.courier}’s site`}<ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </section>

      <section className="glass rounded-2xl p-5 mb-5" aria-labelledby="items-h">
        <h2 id="items-h" className="text-white font-semibold mb-2">Items</h2>
        <ul className="divide-y divide-white/5">
          {order.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-3">
              <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/10 shrink-0">
                {i.image ? <ProtectedImage src={thumbOf(i.image)!} alt="" className="w-full h-full" /> : <ProductPlaceholder name={i.name} size="sm" />}
              </div>
              <div className="flex-1 min-w-0">
                {i.product?.isActive ? <Link href={`/store/p/${i.product.slug}`} className="text-white text-sm hover:text-[#FF85A1]">{i.name}</Link> : <span className="text-white text-sm">{i.name}</span>}
                <p className="text-white/45 text-xs">{i.quantity} × {formatRand(i.priceCents)}</p>
              </div>
              <span className="text-white text-sm font-medium tabular-nums">{formatRand(i.priceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="border-t border-white/10 pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-white/65"><dt>Subtotal</dt><dd className="tabular-nums">{formatRand(order.subtotalCents)}</dd></div>
          <div className="flex justify-between text-white/65"><dt>Delivery</dt><dd className="tabular-nums">{order.shippingCents ? formatRand(order.shippingCents) : 'Free'}</dd></div>
          <div className="flex justify-between text-white font-semibold pt-1"><dt>Total <span className="text-white/45 font-normal text-xs">incl. VAT</span></dt><dd className="tabular-nums">{formatRand(order.totalCents)}</dd></div>
        </dl>
      </section>

      <section className="glass rounded-2xl p-5 grid gap-5 sm:grid-cols-2" aria-label="Delivery">
        <div>
          <h2 className="text-white font-semibold mb-2 text-sm">Delivering to</h2>
          <address className="not-italic text-white/65 text-sm leading-relaxed">
            {order.recipientName}<br />{order.addressLine1}<br />{order.addressLine2 && <>{order.addressLine2}<br /></>}
            {order.suburb && <>{order.suburb}<br /></>}{order.city}, {order.postalCode}<br />{order.province}
          </address>
          <p className="text-white/45 text-xs mt-2">{order.phone} · {order.email}</p>
        </div>
        <div>
          <h2 className="text-white font-semibold mb-2 text-sm flex items-center gap-1.5"><Package size={14} className="text-[#D4AF37]" aria-hidden="true" />Packaging</h2>
          <p className="text-white/65 text-sm">{order.discreetPackaging ? `Discreet — plain box, sender “${discreetSender}”.` : 'Standard packaging.'}</p>
          {order.deliveryNotes && <p className="text-white/50 text-xs mt-2 whitespace-pre-line break-words">Notes: {order.deliveryNotes}</p>}
        </div>
      </section>

      <p className="text-white/45 text-xs mt-5">
        Need help? Email <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Order ${order.number}`)}`} className="text-[#FF4D6D] hover:underline">{SUPPORT_EMAIL}</a> with your order number. Returns are covered by our <Link href={STORE_TERMS_HREF} className="text-[#FF4D6D] hover:underline">store terms</Link>.
      </p>
    </div>
  );
}
