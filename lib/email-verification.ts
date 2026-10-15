import { db } from '@/lib/db'

/**
 * New members must confirm their email (link in the sign-up email) before
 * using the site. Switched on with REQUIRE_EMAIL_VERIFICATION=true — keep it off
 * until email delivery (Brevo domain authentication) works, or new sign-ups
 * would be stuck. Members who joined before this existed count as confirmed.
 */
export function emailVerificationRequired(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFICATION === 'true'
}

export const EMAIL_UNVERIFIED_ERROR = 'Please confirm your email address first — check your inbox for the link we sent.'

/** For API routes: true if this user may act (verification off, confirmed, or admin). */
export async function hasConfirmedEmail(userId: string): Promise<boolean> {
  if (!emailVerificationRequired()) return true
  const u = await db.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true, role: true } })
  return !!u && (!!u.emailVerifiedAt || u.role === 'ADMIN')
}
