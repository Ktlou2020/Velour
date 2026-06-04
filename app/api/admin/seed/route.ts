import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const sessionUser = session.user as { id: string; role?: string }
    if (sessionUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json() as { type: 'events' | 'forums' }
    const { type } = body

    if (type === 'forums') {
      const existing = await db.forumCategory.count()
      if (existing > 0) {
        return NextResponse.json({ seeded: false, message: 'Forum categories already exist', count: existing })
      }

      const categories = [
        { name: 'General Discussion', slug: 'general', description: 'Chat about anything', icon: '💬', order: 0 },
        { name: 'Dating Tips', slug: 'dating-tips', description: 'Advice and experiences', icon: '❤️', order: 1 },
        { name: 'Couples Corner', slug: 'couples', description: 'For couples and partners', icon: '👫', order: 2 },
        { name: 'Events & Meetups', slug: 'events-meetups', description: 'Upcoming gatherings', icon: '🎉', order: 3 },
        { name: 'Lifestyle', slug: 'lifestyle', description: 'Travel, dining, culture', icon: '✨', order: 4 },
        { name: 'Introductions', slug: 'introductions', description: 'Say hello to the community', icon: '👋', order: 5 },
      ]

      await db.forumCategory.createMany({ data: categories })
      return NextResponse.json({ seeded: true, count: categories.length })
    }

    if (type === 'events') {
      const now = new Date()
      const week2 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      const week3 = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)
      const week4 = new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000)

      const events = [
        {
          title: 'Velour Mixer — Johannesburg',
          description: 'An exclusive evening mixer for Velour members in Joburg. Dress to impress!',
          date: week2,
          location: 'The Maslow Hotel, Sandton',
          city: 'Johannesburg',
          country: 'South Africa',
          category: 'MEETUP' as const,
          isFeatured: true,
          createdBy: sessionUser.id,
        },
        {
          title: 'Cape Town Sunset Social',
          description: 'Join fellow members for sundowners at one of Cape Town\'s most iconic venues.',
          date: week3,
          location: 'Signal Hill, Cape Town',
          city: 'Cape Town',
          country: 'South Africa',
          category: 'PARTY' as const,
          isFeatured: true,
          createdBy: sessionUser.id,
        },
        {
          title: 'Durban Beach Brunch',
          description: 'A relaxed morning brunch on the beachfront — perfect for making new connections.',
          date: week4,
          location: 'uShaka Marine World, Durban',
          city: 'Durban',
          country: 'South Africa',
          category: 'MEETUP' as const,
          isFeatured: false,
          createdBy: sessionUser.id,
        },
      ]

      await db.event.createMany({ data: events })
      return NextResponse.json({ seeded: true, count: events.length })
    }

    return NextResponse.json({ error: 'Invalid type. Use "events" or "forums"' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/admin/seed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
