import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { db } from '@/lib/db'
import { audit } from '@/lib/admin-team'
import { isValidId } from '@/lib/security'
import { sendBrandedEmail, escapeHtml } from '@/lib/email'
import { membersById } from '@/lib/support-admin'
import { SITE_URL } from '@/app/site'
import { categoryLabel, cleanText, ticketRef, REPLY_MAX } from '@/lib/support'

type Ctx = { params: Promise<{ id: string }> }

const SELECT = {
  id: true, userId: true, email: true, category: true, subject: true, message: true, status: true,
  adminReply: true, repliedById: true, repliedAt: true, createdAt: true, updatedAt: true,
} as const

async function load(id: string) {
  const t = await db.supportTicket.findUnique({ where: { id }, select: SELECT })
  if (!t) return null
  const people = await membersById([t.userId, t.repliedById].filter((x): x is string => !!x))
  return {
    ...t,
    member: t.userId ? people.get(t.userId) ?? null : null,
    repliedBy: t.repliedById ? people.get(t.repliedById) ?? null : null,
  }
}

/** GET → the full ticket. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ticket = await load(id)
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ticket })
}

/**
 * PATCH { action: 'reply', reply } → saves the reply, emails the member, status ANSWERED.
 * PATCH { action: 'close' | 'reopen' } → status CLOSED / OPEN.
 * Every change is written to the admin audit log.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const me = await requireAdmin()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  if (!isValidId(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = (await req.json().catch(() => null)) as { action?: unknown; reply?: unknown } | null
  const action = body?.action
  if (action !== 'reply' && action !== 'close' && action !== 'reopen') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const ticket = await db.supportTicket.findUnique({ where: { id }, select: { id: true, email: true, subject: true, category: true, message: true, status: true, userId: true } })
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const ref = ticketRef(ticket.id)

  if (action === 'reply') {
    const reply = cleanText(body?.reply, true)
    if (reply.length < 2) return NextResponse.json({ error: 'Write a reply first.' }, { status: 400 })
    if (reply.length > REPLY_MAX) return NextResponse.json({ error: `Reply must be ${REPLY_MAX} characters or fewer.` }, { status: 400 })

    await db.supportTicket.update({
      where: { id },
      data: { adminReply: reply, repliedById: me.id, repliedAt: new Date(), status: 'ANSWERED' },
    })

    let emailed = true
    try {
      await sendBrandedEmail(
        ticket.email,
        `Re: ${ticket.subject} [#${ref}]`,
        'A reply from Unbound support',
        `<p style="white-space:pre-wrap">${escapeHtml(reply).replace(/\n/g, '<br/>')}</p>
         <p style="margin-top:24px;color:#999;font-size:13px">
           <strong>Your message</strong> (#${escapeHtml(ref)} · ${escapeHtml(categoryLabel(ticket.category))})<br/>
           ${escapeHtml(ticket.message.slice(0, 1000)).replace(/\n/g, '<br/>')}${ticket.message.length > 1000 ? '…' : ''}
         </p>
         <p style="color:#999;font-size:13px">This mailbox isn’t monitored. Need more help? Use our <a href="${SITE_URL}/help/contact" style="color:#DC143C">contact form</a> and quote #${escapeHtml(ref)}.</p>`,
      )
    } catch (e) {
      emailed = false
      console.error('support reply email failed:', e instanceof Error ? e.message : e)
    }
    await audit(me.id, 'SUPPORT_REPLIED', ticket.userId, { ticketId: id, emailed })
    return NextResponse.json({ ok: true, emailed, ticket: await load(id) })
  }

  const status = action === 'close' ? 'CLOSED' : 'OPEN'
  await db.supportTicket.update({ where: { id }, data: { status } })
  await audit(me.id, action === 'close' ? 'SUPPORT_CLOSED' : 'SUPPORT_REOPENED', ticket.userId, { ticketId: id })
  return NextResponse.json({ ok: true, ticket: await load(id) })
}
