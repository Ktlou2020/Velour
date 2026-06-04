import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { photoUrl } = await req.json() as { photoUrl?: string }
    if (!photoUrl) return NextResponse.json({ error: 'photoUrl required' }, { status: 400 })

    // Upsert verification request
    await db.verificationRequest.upsert({
      where: { userId: session.user.id },
      update: { photoUrl, status: 'PENDING', notes: null },
      create: { userId: session.user.id, photoUrl, status: 'PENDING' },
    })

    await db.user.update({
      where: { id: session.user.id },
      data: { verificationStatus: 'PENDING', verificationPhoto: photoUrl },
    })

    return NextResponse.json({ ok: true, status: 'PENDING' })
  } catch (error) {
    console.error('POST /api/verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { verificationStatus: true, verificationPhoto: true },
    })

    return NextResponse.json({ status: user?.verificationStatus ?? 'NONE' })
  } catch (error) {
    console.error('GET /api/verify error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
