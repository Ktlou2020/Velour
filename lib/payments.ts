/**
 * Which payment provider takes payments (server only).
 * Paystack when PAYSTACK_SECRET_KEY is set, else PayFast when configured,
 * else none ("Payments aren't set up yet").
 */
import { PAYMENTS_NOT_CONFIGURED, payfastConfig } from '@/lib/payfast'
import { paystackConfig } from '@/lib/paystack'

export type PaymentProvider = 'PAYSTACK' | 'PAYFAST'

export { PAYMENTS_NOT_CONFIGURED }

export function activePaymentProvider(): PaymentProvider | null {
  if (paystackConfig()) return 'PAYSTACK'
  if (payfastConfig()) return 'PAYFAST'
  return null
}

export function paymentProviderLabel(p: PaymentProvider | string | null | undefined): string {
  return p === 'PAYSTACK' ? 'Paystack' : p === 'PAYFAST' ? 'PayFast' : 'our payment provider'
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}
