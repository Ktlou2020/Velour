import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as { partnerUsername: string }
    const { partnerUsername } = body

    if (!partnerUsername) {
      return NextResponse.json({ error: 'partnerUsername is required' }, { status: 400 })
    }

    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, username: true },
    })

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const partner = await db.user.findUnique({
      where: { username: partnerUsername },
      select: { id: true, username: true },
    })

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    if (partner.id === currentUser.id) {
      return NextResponse.json({ error: 'Cannot invite yourself' }, { status: 400 })
    }

    await db.notification.create({
      data: {
        userId: partner.id,
        type: 'COUPLE_INVITE',
        title: 'Couple Invitation',
        body: `${currentUser.username} wants to link profiles with you`,
        data: { inviterId: currentUser.id, inviterUsername: currentUser.username },
      },
    })

    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error('POST /api/couple/invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
