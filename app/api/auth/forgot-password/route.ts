import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body as { email?: string }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    })

    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await db.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpiry: expiry,
        },
      })

      try {
        await sendPasswordResetEmail(user.email, token)
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError)
      }
    }

    // Always return success — don't reveal if email exists
    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error('POST /api/auth/forgot-password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
