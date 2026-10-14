import type { Metadata } from 'next';
import { auth } from '@/auth';
import { getMyOrder, ORDER_NUMBER_RE } from '@/lib/store/user-orders';
import ThankYouClient from './ThankYouClient';
import { notFound } from 'next/navigation';

export const metadata: Metadata = { title: 'Thank you' };
export const dynamic = 'force-dynamic';

export default async function ThankYouPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: number } = await searchParams;
  if (!number || !ORDER_NUMBER_RE.test(number)) notFound();
  const session = await auth();
  const order = await getMyOrder(session!.user!.id!, number);
  if (!order) notFound();
  return <ThankYouClient number={order.number} initialStatus={order.status} email={order.email} />;
}
