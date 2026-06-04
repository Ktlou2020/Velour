import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const city = searchParams.get('city')
    const category = searchParams.get('category')

    const events = await db.event.findMany({
      where: {
        date: { gte: new Date() },
        isPrivate: false,
        ...(city ? { city: { contains: city, mode: 'insensitive' as const } } : {}),
        ...(category ? { category: category as never } : {}),
      },
      include: {
        _count: { select: { attendees: true } },
      },
      orderBy: { date: 'asc' },
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('GET /api/events error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin OR paying members can create events
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, profile: { select: { membershipTier: true } } },
    })

    const isPaying = user?.profile?.membershipTier === 'GOLD' || user?.profile?.membershipTier === 'PLATINUM'
    if (!user || (user.role !== 'ADMIN' && !isPaying)) {
      return NextResponse.json({ error: 'Upgrade to Gold or Platinum to create events' }, { status: 403 })
    }

    const body = await req.json()
    const {
      title,
      description,
      date,
      endDate,
      location,
      city,
      country,
      maxAttendees,
      imageUrl,
      category,
      isPrivate = false,
    } = body

    if (!title || !description || !date || !location) {
      return NextResponse.json(
        { error: 'title, description, date, and location are required' },
        { status: 400 }
      )
    }

    const event = await db.event.create({
      data: {
        title,
        description,
        date: new Date(date),
        endDate: endDate ? new Date(endDate) : undefined,
        location,
        city,
        country,
        maxAttendees,
        imageUrl,
        category: category ?? 'OTHER',
        isPrivate,
        createdBy: session.user.id,
      },
    })

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    console.error('POST /api/events error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
