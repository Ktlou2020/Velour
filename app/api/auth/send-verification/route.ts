import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { sendVerificationEmail } from '@/lib/email'

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    const user = await db.user.update({
      where: { id: session.user.id },
      data: {
        emailVerifyToken: token,
        emailVerifyExpiry: expiry,
      },
      select: { email: true },
    })

    try {
      await sendVerificationEmail(user.email, token)
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
    }

    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error('POST /api/auth/send-verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
