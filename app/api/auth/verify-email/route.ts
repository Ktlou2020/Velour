import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(new URL('/auth/verify-email?error=missing', req.url))
    }

    const user = await db.user.findFirst({
      where: {
        emailVerifyToken: token,
        emailVerifyExpiry: { gt: new Date() },
      },
      select: { id: true },
    })

    if (!user) {
      return NextResponse.redirect(new URL('/auth/verify-email?error=invalid', req.url))
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        emailVerifyToken: null,
        emailVerifyExpiry: null,
      },
    })

    return NextResponse.redirect(new URL('/members?verified=1', req.url))
  } catch (error) {
    console.error('GET /api/auth/verify-email error:', error)
    return NextResponse.redirect(new URL('/auth/verify-email?error=server', req.url))
  }
}
