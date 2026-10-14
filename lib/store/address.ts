/** Delivery details validation, shared by the checkout form and POST /api/store/checkout. */
import { SA_PROVINCES } from './config'
import { lineText, plainText } from './format'

export interface DeliveryInput {
  recipientName: string
  phone: string
  email: string
  addressLine1: string
  addressLine2: string
  suburb: string
  city: string
  province: string
  postalCode: string
  deliveryNotes: string
  discreetPackaging: boolean
}

export type DeliveryErrors = Partial<Record<keyof DeliveryInput, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * South African phone number → national format "0821234567", or null.
 * Accepts spaces, dashes, brackets and +27 / 27 / 0 prefixes.
 */
export function normalizeSaPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '')
  const m = /^(?:\+27|0027|27|0)([1-8]\d{8})$/.exec(digits)
  return m ? `0${m[1]}` : null
}

/** SA mobile numbers start 06, 07 or 08. */
export function isSaMobile(national: string): boolean {
  return /^0[6-8]\d{8}$/.test(national)
}

export function validateDelivery(raw: Record<string, unknown>): { value: DeliveryInput; errors: DeliveryErrors } {
  const value: DeliveryInput = {
    recipientName: lineText(raw.recipientName, 100),
    phone: lineText(raw.phone, 30),
    email: lineText(raw.email, 200).toLowerCase(),
    addressLine1: lineText(raw.addressLine1, 120),
    addressLine2: lineText(raw.addressLine2, 120),
    suburb: lineText(raw.suburb, 80),
    city: lineText(raw.city, 80),
    province: lineText(raw.province, 40),
    postalCode: lineText(raw.postalCode, 10),
    deliveryNotes: plainText(raw.deliveryNotes, 500),
    discreetPackaging: raw.discreetPackaging !== false,
  }
  const errors: DeliveryErrors = {}
  if (value.recipientName.length < 2) errors.recipientName = 'Enter the recipient’s name'
  const phone = normalizeSaPhone(value.phone)
  if (!phone) errors.phone = 'Enter a South African number, e.g. 082 123 4567'
  else value.phone = phone
  if (!EMAIL_RE.test(value.email)) errors.email = 'Enter a valid email address'
  if (value.addressLine1.length < 3) errors.addressLine1 = 'Enter a street address'
  if (value.city.length < 2) errors.city = 'Enter a city or town'
  if (!(SA_PROVINCES as readonly string[]).includes(value.province)) errors.province = 'Choose a province'
  if (!/^\d{4}$/.test(value.postalCode)) errors.postalCode = 'Postal codes have 4 digits'
  return { value, errors }
}
