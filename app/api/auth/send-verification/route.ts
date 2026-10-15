import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { sendVerificationEmail } from '@/lib/email'
import { rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { generateToken, hashToken } from '@/lib/security'

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!rateLimit(`send-verification:${session.user.id}`, 3, 60 * 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }

    const current = await db.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerifiedAt: true },
    })
    if (!current) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (current.emailVerifiedAt) {
      return NextResponse.json({ sent: false, alreadyVerified: true })
    }

    const token = generateToken()
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const user = await db.user.update({
      where: { id: session.user.id },
      data: {
        emailVerifyToken: hashToken(token),
        emailVerifyExpiry: expiry,
      },
      select: { email: true },
    })

    try {
      await sendVerificationEmail(user.email, token)
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError instanceof Error ? emailError.message : emailError)
    }

    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error('POST /api/auth/send-verification error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
