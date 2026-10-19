/**
 * Auto-fulfillment via CJ Dropshipping.
 * Called after an order is marked PAID. Only submits lines where the product
 * has a cjPid/cjVariantId — items without those are flagged for manual handling.
 */

import { db } from '@/lib/db'
import { createCJOrder } from '@/lib/cj'

export async function submitOrderToCJ(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      recipientName: true,
      phone: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      province: true,
      postalCode: true,
      deliveryNotes: true,
      cjOrderId: true,
      items: {
        select: {
          quantity: true,
          product: { select: { cjPid: true, cjVariantId: true, name: true } },
        },
      },
    },
  })

  if (!order) return
  if (order.cjOrderId) return // already submitted

  const lines = order.items
    .filter(i => i.product?.cjVariantId)
    .map(i => ({ vid: i.product!.cjVariantId!, quantity: i.quantity }))

  if (!lines.length) return // no CJ products in this order

  try {
    const result = await createCJOrder({
      orderNumber: order.number,
      lines,
      shipping: {
        name: order.recipientName,
        phone: order.phone,
        addressLine1: order.addressLine1,
        addressLine2: order.addressLine2 ?? undefined,
        city: order.city,
        province: order.province,
        country: 'South Africa',
        zip: order.postalCode,
      },
      remark: [
        'Discreet packaging — no brand markings on parcel.',
        order.deliveryNotes ?? '',
      ].filter(Boolean).join(' '),
    })

    await db.order.update({
      where: { id: orderId },
      data: { cjOrderId: result.orderId, status: 'PROCESSING' },
    })
  } catch (err) {
    // Non-fatal — admin will see the order as PAID without a cjOrderId and
    // can retry via the admin panel.
    console.error(`[CJ] Failed to submit order ${order.number}:`, err)
  }
}
