import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashToken } from '@/lib/security'
import { maybeRewardReferral } from '@/lib/referrals'

// Called via fetch() from /auth/verify-email. Returns JSON (not a redirect) so
// the page can tell success from failure.
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')

    if (!token || token.length > 200) {
      return NextResponse.json({ error: 'missing' }, { status: 400 })
    }

    // Tokens are stored as SHA-256 hashes, single-use, with an expiry.
    const user = await db.user.findFirst({
      where: {
        emailVerifyToken: hashToken(token),
        emailVerifyExpiry: { gt: new Date() },
      },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 })
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerifyToken: null,
        emailVerifyExpiry: null,
      },
    })

    // Invite-a-friend: confirming the email may complete a pending referral.
    await maybeRewardReferral(user.id)

    return NextResponse.json({ verified: true })
  } catch (error) {
    console.error('GET /api/auth/verify-email error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
