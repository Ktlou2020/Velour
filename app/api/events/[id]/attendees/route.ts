import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

/**
 * GET /api/events/[id]/attendees
 * "Who else went" for a past event. Only available to members who RSVP'd
 * GOING, and only once the event has ended. Blocked users (either direction),
 * deactivated and incognito accounts are excluded.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: eventId } = await params

    const event = await db.event.findUnique({
      where: { id: eventId },
      select: { id: true, date: true, endDate: true },
    })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const endedAt = event.endDate ?? event.date
    if (endedAt.getTime() > Date.now()) {
      return NextResponse.json({ error: 'Attendee list is available once the event has ended' }, { status: 403 })
    }

    const mine = await db.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { status: true },
    })
    if (!mine || mine.status !== 'GOING') {
      return NextResponse.json({ error: 'Only members who attended can see who went' }, { status: 403 })
    }

    const blocks = await db.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    })
    const excluded = new Set<string>([userId])
    for (const b of blocks) {
      excluded.add(b.blockerId === userId ? b.blockedId : b.blockerId)
    }

    const rows = await db.eventAttendee.findMany({
      where: {
        eventId,
        status: 'GOING',
        userId: { notIn: [...excluded] },
        user: { isActive: true, profile: { is: { incognito: false } } },
      },
      select: {
        user: {
          select: {
            username: true,
            profile: { select: { displayName: true, profilePhoto: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    })

    const attendees = rows.map((r) => ({
      username: r.user.username,
      displayName: r.user.profile?.displayName ?? null,
      profilePhoto: r.user.profile?.profilePhoto ?? null,
    }))

    return NextResponse.json({ attendees })
  } catch (error) {
    console.error('GET /api/events/[id]/attendees error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
