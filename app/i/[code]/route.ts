import { NextRequest, NextResponse } from 'next/server'
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE, normalizeReferralCode } from '@/lib/referrals'

export const dynamic = 'force-dynamic'

/**
 * Invite link: /i/<code> → remember the code for 30 days (httpOnly cookie, read
 * by /api/register) and send the visitor to sign-up with ?ref= so the page can
 * show the "you were invited" note. Unknown-looking codes just go to sign-up.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params
  const code = normalizeReferralCode(raw)
  const target = new URL('/auth/signup', req.nextUrl.origin)
  if (code) target.searchParams.set('ref', code)
  const res = NextResponse.redirect(target, 307)
  if (code) {
    res.cookies.set(REFERRAL_COOKIE, code, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: REFERRAL_COOKIE_MAX_AGE,
    })
  }
  return res
}
