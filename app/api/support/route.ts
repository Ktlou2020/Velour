import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { sendBrandedEmail, escapeHtml } from '@/lib/email'
import {
  categoryLabel, cleanText, isSupportCategory, isValidEmail, ticketRef,
  EMAIL_MAX, MESSAGE_MAX, MESSAGE_MIN, SUBJECT_MAX,
} from '@/lib/support'

const HOUR = 60 * 60 * 1000

/**
 * POST /api/support — open a support ticket from /help/contact.
 * Body: { category, subject, message, email? }. Signed-in members always use
 * their account email (any email in the body is ignored); visitors must give one.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  if (!rateLimit(`support:ip:${ip}`, 5, HOUR)) {
    return NextResponse.json({ error: 'You’ve sent a few requests already. Please wait an hour and try again, or email us.' }, { status: 429 })
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  // Honeypot: a hidden field real people never fill in. Pretend it worked.
  if (typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json({ ok: true, ref: 'THANKS' })
  }

  const session = await auth()
  const sessionUserId = session?.user?.id ?? null
  let userId: string | null = null
  let email: string

  if (sessionUserId) {
    const user = await db.user.findUnique({ where: { id: sessionUserId }, select: { id: true, email: true, isActive: true } })
    if (user && user.isActive) {
      userId = user.id
      email = user.email
    } else {
      email = ''
    }
  } else {
    email = ''
  }

  if (userId) {
    if (!rateLimit(`support:user:${userId}`, 5, HOUR)) {
      return NextResponse.json({ error: 'You’ve sent a few requests already. Please wait an hour and try again.' }, { status: 429 })
    }
  } else {
    email = cleanText(body.email).toLowerCase().slice(0, EMAIL_MAX + 1)
    if (!isValidEmail(email)) return NextResponse.json({ error: 'Please enter a valid email address so we can reply.' }, { status: 400 })
    if (!rateLimit(`support:email:${email}`, 5, HOUR)) {
      return NextResponse.json({ error: 'You’ve sent a few requests already. Please wait an hour and try again.' }, { status: 429 })
    }
  }

  if (!isSupportCategory(body.category)) return NextResponse.json({ error: 'Please choose a category.' }, { status: 400 })
  const category = body.category
  const subject = cleanText(body.subject)
  const message = cleanText(body.message, true)
  if (subject.length < 3) return NextResponse.json({ error: 'Please add a short subject.' }, { status: 400 })
  if (subject.length > SUBJECT_MAX) return NextResponse.json({ error: `Subject must be ${SUBJECT_MAX} characters or fewer.` }, { status: 400 })
  if (message.length < MESSAGE_MIN) return NextResponse.json({ error: 'Please tell us a little more so we can help.' }, { status: 400 })
  if (message.length > MESSAGE_MAX) return NextResponse.json({ error: `Message must be ${MESSAGE_MAX} characters or fewer.` }, { status: 400 })

  const ticket = await db.supportTicket.create({
    data: { userId, email, category, subject, message },
    select: { id: true },
  })
  const ref = ticketRef(ticket.id)

  // Confirmation email: best effort, never fails the request.
  try {
    await sendBrandedEmail(
      email,
      `We’ve received your message [#${ref}]`,
      'We’ve got your message',
      `<p>Thanks for contacting Unbound support. A real person on our team will read your message and reply to this email address, usually within 1 business day.</p>
       <p><strong>Reference:</strong> #${escapeHtml(ref)}<br/>
       <strong>Category:</strong> ${escapeHtml(categoryLabel(category))}<br/>
       <strong>Subject:</strong> ${escapeHtml(subject)}</p>
       <p style="white-space:pre-wrap;border-left:3px solid #DC143C;padding-left:12px;color:#bbb">${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
       <p>If you’re in immediate danger, please call SAPS on 10111 or 112 from a mobile phone.</p>`,
    )
  } catch (e) {
    console.error('support confirmation email failed:', e instanceof Error ? e.message : e)
  }

  return NextResponse.json({ ok: true, ref })
}
