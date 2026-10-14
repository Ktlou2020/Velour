import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getClientIp, rateLimit, TOO_MANY_REQUESTS_MESSAGE } from '@/lib/rate-limit'
import { BCRYPT_COST, hashToken, validatePassword } from '@/lib/security'

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers)
    if (!rateLimit(`reset:ip:${ip}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json({ error: TOO_MANY_REQUESTS_MESSAGE }, { status: 429 })
    }

    const body = await req.json().catch(() => null) as { token?: unknown; password?: unknown } | null
    const token = typeof body?.token === 'string' ? body.token : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!token || !password || token.length > 200) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
    }

    const user = await db.user.findFirst({
      where: {
        passwordResetToken: hashToken(token),
        passwordResetExpiry: { gt: new Date() },
      },
      select: { id: true, email: true, username: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'This reset link is invalid or has expired.' },
        { status: 400 }
      )
    }

    const passwordError = validatePassword(password, { email: user.email, username: user.username })
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST)

    // Single use: the conditional update only succeeds if the token is still
    // present, so two concurrent requests can't both consume it.
    const result = await db.user.updateMany({
      where: { id: user.id, passwordResetToken: hashToken(token) },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    })
    if (result.count === 0) {
      return NextResponse.json(
        { error: 'This reset link is invalid or has expired.' },
        { status: 400 }
      )
    }

    // Existing sessions are invalidated on their next refresh (the session
    // token carries a fingerprint of the password hash).
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/auth/reset-password error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
