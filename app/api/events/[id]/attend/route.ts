import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: eventId } = await params

    const event = await db.event.findUnique({ where: { id: eventId } })
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const existing = await db.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId: session.user.id } },
    })

    if (existing) {
      // Toggle: if GOING -> NOT_GOING, if NOT_GOING -> GOING
      const newStatus = existing.status === 'GOING' ? 'NOT_GOING' : 'GOING'
      const attendee = await db.eventAttendee.update({
        where: { id: existing.id },
        data: { status: newStatus },
      })
      return NextResponse.json({ attendee, status: newStatus })
    }

    // Check capacity
    if (event.maxAttendees) {
      const count = await db.eventAttendee.count({
        where: { eventId, status: 'GOING' },
      })
      if (count >= event.maxAttendees) {
        return NextResponse.json({ error: 'Event is at full capacity' }, { status: 409 })
      }
    }

    const attendee = await db.eventAttendee.create({
      data: {
        eventId,
        userId: session.user.id,
        status: 'GOING',
      },
    })

    return NextResponse.json({ attendee, status: 'GOING' }, { status: 201 })
  } catch (error) {
    console.error('POST /api/events/[id]/attend error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
