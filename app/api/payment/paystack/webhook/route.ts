import { NextRequest } from 'next/server'
import { paystackConfig, verifyWebhookSignature } from '@/lib/paystack'
import { handlePaystackEvent } from '@/lib/paystack-events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function reply(body: string, status: number) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } })
}

/**
 * Paystack webhook (Settings → API Keys & Webhooks → Webhook URL:
 * https://www.unboundza.com/api/payment/paystack/webhook).
 *
 * 1. Verify x-paystack-signature = HMAC-SHA512(raw body, secret key) → 401 if wrong.
 * 2. Handle charge.success (memberships + store orders, amount/currency checked),
 *    subscription.create / not_renew / disable, invoice.payment_failed / invoice.update.
 * 3. 200 for handled and ignored events; 500 only when processing should be
 *    retried (Paystack redelivers non-2xx responses).
 * Every handler is idempotent, so redeliveries are harmless.
 */
export async function POST(req: NextRequest) {
  const cfg = paystackConfig()
  if (!cfg) {
    console.error('Paystack webhook received but PAYSTACK_SECRET_KEY is not set')
    return reply('Not configured', 503)
  }
  const raw = await req.text().catch(() => '')
  if (!verifyWebhookSignature(raw, req.headers.get('x-paystack-signature'), cfg.secretKey)) {
    console.warn('Paystack webhook: invalid signature')
    return reply('Invalid signature', 401)
  }
  let payload: { event?: unknown; data?: unknown }
  try {
    payload = JSON.parse(raw) as { event?: unknown; data?: unknown }
  } catch {
    return reply('Bad request', 400)
  }
  const event = typeof payload.event === 'string' ? payload.event : ''
  try {
    const outcome = await handlePaystackEvent(event, payload.data)
    if (outcome === 'retry') return reply('Retry later', 500)
    return reply('OK', 200)
  } catch (error) {
    console.error(`Paystack webhook ${event} error:`, error instanceof Error ? error.message : error)
    return reply('Error', 500)
  }
}
