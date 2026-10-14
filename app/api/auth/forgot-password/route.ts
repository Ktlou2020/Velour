import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { generateToken, hashToken } from '@/lib/security'

const HOUR = 60 * 60 * 1000

// Identical response whether or not the account exists (no enumeration).
function genericResponse() {
  return NextResponse.json({ sent: true })
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers)
    if (!rateLimit(`forgot:ip:${ip}`, 10, HOUR)) {
      return NextResponse.json(
        { error: 'Too many reset requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await req.json().catch(() => null) as { email?: unknown } | null
    const email = typeof body?.email === 'string' ? body.email.trim() : ''

    if (!email || email.length > 254) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Per-email limit: silently stop sending, but respond exactly as normal so
    // the limit itself doesn't reveal whether the address is registered.
    if (!rateLimit(`forgot:email:${email.toLowerCase()}`, 3, HOUR)) {
      return genericResponse()
    }

    const user =
      (await db.user.findUnique({ where: { email }, select: { id: true, email: true, isActive: true } })) ??
      (await db.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, email: true, isActive: true },
      }))

    if (user && user.isActive) {
      const token = generateToken()
      const expiry = new Date(Date.now() + HOUR)

      // Store only the hash; a new request invalidates any previous link.
      await db.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: hashToken(token),
          passwordResetExpiry: expiry,
        },
      })

      // Don't await delivery: keeps response time similar for unknown emails.
      sendPasswordResetEmail(user.email, token).catch((emailError) => {
        console.error('Failed to send password reset email:', emailError instanceof Error ? emailError.message : emailError)
      })
    }

    return genericResponse()
  } catch (error) {
    console.error('POST /api/auth/forgot-password error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
