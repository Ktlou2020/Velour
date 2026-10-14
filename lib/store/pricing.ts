/** Pure pricing rules shared by client (estimates) and server (authoritative). */

export function shippingFor(subtotalCents: number, s: { shippingCents: number; freeShippingOverCents: number }): number {
  if (subtotalCents <= 0) return 0
  if (s.freeShippingOverCents > 0 && subtotalCents >= s.freeShippingOverCents) return 0
  return s.shippingCents
}
