import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { isOwnMediaUrl } from '@/lib/media'
import { isVerificationPose, randomPose } from '@/lib/verification'

/**
 * POST { photoUrl, pose } → submit a verification selfie for admin review.
 * The photo must be one the member uploaded with purpose=verification, and the
 * pose one we asked for (lib/verification.ts).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id

    const { photoUrl, pose } = await req.json().catch(() => ({})) as { photoUrl?: unknown; pose?: unknown }
    if (typeof photoUrl !== 'string' || !isOwnMediaUrl(photoUrl)) return NextResponse.json({ error: 'Upload your selfie first' }, { status: 400 })
    if (!isVerificationPose(pose)) return NextResponse.json({ error: 'Pose missing — refresh and try again' }, { status: 400 })
    const own = await db.photo.findFirst({ where: { url: photoUrl, userId }, select: { id: true } })
    if (!own) return NextResponse.json({ error: 'Upload your selfie first' }, { status: 400 })

    await db.verificationRequest.upsert({
      where: { userId },
      update: { photoUrl, pose, status: 'PENDING', notes: null },
      create: { userId, photoUrl, pose, status: 'PENDING' },
    })
    await db.user.update({ where: { id: userId }, data: { verificationStatus: 'PENDING', verificationPhoto: photoUrl } })

    return NextResponse.json({ ok: true, status: 'PENDING' })
  } catch (error) {
    console.error('POST /api/verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** GET → { status, pose, notes }: a fresh pose to copy unless a request is pending. */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const [user, request] = await Promise.all([
      db.user.findUnique({ where: { id: session.user.id }, select: { verificationStatus: true, isVerified: true } }),
      db.verificationRequest.findUnique({ where: { userId: session.user.id }, select: { status: true, pose: true, notes: true } }),
    ])
    const status = user?.isVerified ? 'VERIFIED' : (user?.verificationStatus ?? 'NONE')
    return NextResponse.json({
      status,
      pose: status === 'PENDING' && request?.pose ? request.pose : randomPose(),
      notes: status === 'REJECTED' ? request?.notes ?? null : null,
    })
  } catch (error) {
    console.error('GET /api/verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
