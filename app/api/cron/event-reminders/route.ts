import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'
import { sendBrandedEmail, escapeHtml } from '@/lib/email'

export const dynamic = 'force-dynamic'

const WINDOW_MS = 24 * 60 * 60 * 1000
const MAX_PER_RUN = 500
const CHUNK = 25
const TZ = 'Africa/Johannesburg'

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const a = Buffer.from(header)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Sends RSVP reminders (push + email + in-app notification) to members who
 * are GOING to an event starting in the next 24 hours. Idempotent: each
 * attendee row is claimed by setting reminderSentAt before anything is sent,
 * so overlapping runs never double-notify. Schedule hourly — see README.
 */
async function handler(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const until = new Date(now.getTime() + WINDOW_MS)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const pending = await db.eventAttendee.findMany({
    where: {
      status: 'GOING',
      reminderSentAt: null,
      event: { date: { gt: now, lte: until } },
      user: { isActive: true },
    },
    select: {
      id: true,
      userId: true,
      user: { select: { email: true, username: true, profile: { select: { displayName: true } } } },
      event: { select: { id: true, title: true, date: true, location: true } },
    },
    orderBy: { event: { date: 'asc' } },
    take: MAX_PER_RUN,
  })

  let sent = 0
  let failed = 0

  for (let i = 0; i < pending.length; i += CHUNK) {
    const chunk = pending.slice(i, i + CHUNK)

    // Claim rows first so a concurrent run can't pick them up too.
    const claimed = await db.eventAttendee.updateMany({
      where: { id: { in: chunk.map((a) => a.id) }, reminderSentAt: null },
      data: { reminderSentAt: now },
    })
    if (claimed.count === 0) continue
    const stillOurs = new Set(
      (await db.eventAttendee.findMany({
        where: { id: { in: chunk.map((a) => a.id) }, reminderSentAt: now },
        select: { id: true },
      })).map((r) => r.id)
    )

    const results = await Promise.allSettled(
      chunk.filter((a) => stillOurs.has(a.id)).map(async (a) => {
        const { event, user } = a
        const when = event.date.toLocaleString('en-ZA', {
          weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: TZ,
        })
        const name = user.profile?.displayName || user.username
        const url = `/events`

        await db.notification.create({
          data: {
            userId: a.userId,
            type: 'EVENT_REMINDER',
            title: 'Event tomorrow',
            body: `${event.title} — ${when}`.slice(0, 200),
            data: { eventId: event.id },
          },
        })

        await Promise.allSettled([
          sendPushToUser(a.userId, {
            title: `Reminder: ${event.title}`.slice(0, 100),
            body: `${when} · ${event.location}`.slice(0, 150),
            url,
            tag: `event-reminder-${event.id}`,
          }),
          sendBrandedEmail(
            user.email,
            `Reminder: ${event.title}`.slice(0, 150),
            'Event Reminder',
            `
              <h2 style="color:#ffffff; font-family:'Georgia',serif; font-size:22px; margin:0 0 16px;">See you soon, ${escapeHtml(name)}</h2>
              <p style="color:#aaaacc; font-size:15px; line-height:1.7; margin:0 0 16px;">
                You're going to <strong style="color:#ffffff;">${escapeHtml(event.title)}</strong>.
              </p>
              <p style="color:#aaaacc; font-size:15px; line-height:1.7; margin:0 0 4px;"><strong style="color:#D4AF37;">When:</strong> ${escapeHtml(when)}</p>
              <p style="color:#aaaacc; font-size:15px; line-height:1.7; margin:0 0 24px;"><strong style="color:#D4AF37;">Where:</strong> ${escapeHtml(event.location)}</p>
              <a href="${appUrl}/events" style="display:inline-block; background:linear-gradient(135deg,#DC143C,#8F0D25); color:#ffffff; text-decoration:none; padding:12px 28px; border-radius:10px; font-weight:bold; font-size:14px;">View event</a>
              <p style="color:#666677; font-size:13px; line-height:1.6; margin:24px 0 0;">
                Meeting someone new? Read our <a href="${appUrl}/safety" style="color:#DC143C; text-decoration:none;">safety tips</a> before you go.
              </p>
            `
          ),
        ])
      })
    )

    for (const r of results) {
      if (r.status === 'fulfilled') sent++
      else {
        failed++
        console.error('[cron/event-reminders] reminder failed:', r.reason)
      }
    }
  }

  return NextResponse.json({ ok: true, candidates: pending.length, sent, failed })
}

export async function GET(req: NextRequest) {
  try {
    return await handler(req)
  } catch (error) {
    console.error('GET /api/cron/event-reminders error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
