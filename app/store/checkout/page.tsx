import type { Metadata } from 'next';
import { AlertCircle } from 'lucide-react';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { activePaymentProvider } from '@/lib/payments';
import PayNowButton from '@/components/store/PayNowButton';
import { ORDER_NUMBER_RE } from '@/lib/store/user-orders';
import { maybeReleaseExpired, minutesLeftToPay } from '@/lib/store/orders';
import CheckoutClient, { type CheckoutPrefill } from './CheckoutClient';

export const metadata: Metadata = { title: 'Checkout' };
export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const session = await auth();
  const userId = session!.user!.id!;
  await maybeReleaseExpired();

  const [user, lastOrder] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { email: true, profile: { select: { displayName: true } } } }),
    db.order.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { recipientName: true, phone: true, email: true, addressLine1: true, addressLine2: true, suburb: true, city: true, province: true, postalCode: true, discreetPackaging: true },
    }),
  ]);
  const prefill: CheckoutPrefill = lastOrder
    ? { ...lastOrder, addressLine2: lastOrder.addressLine2 ?? '', suburb: lastOrder.suburb ?? '' }
    : { recipientName: '', phone: '', email: user?.email ?? '', addressLine1: '', addressLine2: '', suburb: '', city: '', province: '', postalCode: '', discreetPackaging: true };
  if (!prefill.email) prefill.email = user?.email ?? '';

  // Back from PayFast without paying
  const cancelledNumber = sp.cancelled === '1' && sp.order && ORDER_NUMBER_RE.test(sp.order) ? sp.order : null;
  const pending = cancelledNumber
    ? await db.order.findFirst({ where: { userId, number: cancelledNumber }, select: { number: true, status: true, createdAt: true } })
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 sm:pt-10">
      <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-6">Checkout</h1>
      {sp.cancelled === '1' && (
        <div role="status" className="glass rounded-2xl p-4 sm:p-5 mb-6 border border-[#D4AF37]/25">
          <p className="text-white font-medium flex items-center gap-2"><AlertCircle size={17} className="text-[#D4AF37]" aria-hidden="true" />Payment not completed</p>
          {pending?.status === 'PENDING_PAYMENT' && minutesLeftToPay(pending.createdAt) > 0 ? (
            <>
              <p className="text-white/65 text-sm mt-1 mb-4">Order {pending.number} is still reserved for you. Pay now, or cancel it to change your cart.</p>
              <PayNowButton number={pending.number} minutesLeft={minutesLeftToPay(pending.createdAt)} />
            </>
          ) : (
            <p className="text-white/65 text-sm mt-1">You weren’t charged. Your cart is still here whenever you’re ready.</p>
          )}
        </div>
      )}
      <CheckoutClient prefill={prefill} paymentsEnabled={!!activePaymentProvider()} hasPending={pending?.status === 'PENDING_PAYMENT'} />
    </div>
  );
}
