import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentProfile = await db.profile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, partnerId: true },
    })

    if (!currentProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (currentProfile.partnerId) {
      // Unlink partner first
      await db.profile.update({
        where: { id: currentProfile.partnerId },
        data: { partnerId: null, isCouple: false },
      })
    }

    await db.profile.update({
      where: { id: currentProfile.id },
      data: { partnerId: null, isCouple: false },
    })

    return NextResponse.json({ unlinked: true })
  } catch (error) {
    console.error('POST /api/couple/unlink error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
