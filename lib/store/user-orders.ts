/** Member-facing order reads (server only). */
import { db } from '@/lib/db'

export const ORDER_NUMBER_RE = /^[A-Z]{1,6}-\d{1,9}$/

export const myOrderSelect = {
  id: true, number: true, status: true, subtotalCents: true, shippingCents: true, totalCents: true,
  recipientName: true, phone: true, email: true, addressLine1: true, addressLine2: true, suburb: true, city: true,
  province: true, postalCode: true, deliveryNotes: true, discreetPackaging: true, courier: true, trackingNumber: true,
  paymentRef: true, paidAt: true, cancelledAt: true, shippedAt: true, deliveredAt: true, createdAt: true, updatedAt: true,
  items: { select: { id: true, name: true, priceCents: true, quantity: true, image: true, product: { select: { slug: true, isActive: true } } } },
} as const

export async function getMyOrder(userId: string, number: string) {
  if (!ORDER_NUMBER_RE.test(number)) return null
  return db.order.findFirst({ where: { number, userId }, select: myOrderSelect })
}
