/**
 * Public business / legal details shown on the policy and contact pages.
 *
 * All values come from NEXT_PUBLIC_ env vars (inlined at build time, so set
 * them before building). Anything unset is null and simply not rendered —
 * never put placeholder values here.
 *
 *   NEXT_PUBLIC_BUSINESS_LEGAL_NAME    registered company name, e.g. "Example Trading (Pty) Ltd"
 *   NEXT_PUBLIC_BUSINESS_REG_NUMBER    CIPC registration number
 *   NEXT_PUBLIC_BUSINESS_VAT_NUMBER    VAT number (only if VAT-registered)
 *   NEXT_PUBLIC_BUSINESS_ADDRESS       physical address (commas become line breaks)
 *   NEXT_PUBLIC_BUSINESS_PHONE         customer contact number
 *   NEXT_PUBLIC_BUSINESS_EMAIL         optional: overrides the support email
 *   NEXT_PUBLIC_BUSINESS_INFO_OFFICER  POPIA Information Officer's name
 */
import { SUPPORT_EMAIL } from '@/lib/store/config'

function clean(v: string | undefined): string | null {
  const s = (v ?? '').trim()
  return s ? s : null
}

export interface BusinessDetails {
  legalName: string | null
  tradingName: string
  registrationNumber: string | null
  vatNumber: string | null
  address: string | null
  phone: string | null
  email: string
  informationOfficer: string | null
}

// Each process.env.NEXT_PUBLIC_* must be written out literally so Next.js inlines it.
export const BUSINESS: BusinessDetails = {
  legalName: clean(process.env.NEXT_PUBLIC_BUSINESS_LEGAL_NAME),
  tradingName: 'Hush',
  registrationNumber: clean(process.env.NEXT_PUBLIC_BUSINESS_REG_NUMBER),
  vatNumber: clean(process.env.NEXT_PUBLIC_BUSINESS_VAT_NUMBER),
  address: clean(process.env.NEXT_PUBLIC_BUSINESS_ADDRESS),
  phone: clean(process.env.NEXT_PUBLIC_BUSINESS_PHONE),
  email: clean(process.env.NEXT_PUBLIC_BUSINESS_EMAIL) ?? SUPPORT_EMAIL,
  informationOfficer: clean(process.env.NEXT_PUBLIC_BUSINESS_INFO_OFFICER),
}

/** Name to use when referring to the operator in legal text. */
export const OPERATOR_NAME = BUSINESS.legalName ?? BUSINESS.tradingName

/** Address split into display lines (on commas or newlines). */
export function addressLines(address: string | null = BUSINESS.address): string[] {
  if (!address) return []
  return address.split(/\s*(?:,|\n|\\n)\s*/).filter(Boolean)
}
