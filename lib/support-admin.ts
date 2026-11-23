import { db } from '@/lib/db'
import type { SupportStatus } from '@/lib/support'

export interface TicketSummary {
  id: string
  userId: string | null
  email: string
  category: string
  subject: string
  preview: string
  status: string
  createdAt: string
  repliedAt: string | null
  member: { username: string; displayName: string | null } | null
}

export interface TicketCounts { OPEN: number; ANSWERED: number; CLOSED: number }

/** Server-only: the admin inbox list (newest first, capped) and counts per status. */
export async function listTickets(status: SupportStatus | 'ALL'): Promise<{ tickets: TicketSummary[]; counts: TicketCounts }> {
  const [rows, grouped] = await Promise.all([
    db.supportTicket.findMany({
      where: status === 'ALL' ? {} : { status },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, userId: true, email: true, category: true, subject: true, message: true, status: true, createdAt: true, repliedAt: true },
    }),
    db.supportTicket.groupBy({ by: ['status'], _count: { _all: true } }),
  ])
  const members = await membersById(rows.map((r) => r.userId).filter((x): x is string => !!x))
  const counts: TicketCounts = { OPEN: 0, ANSWERED: 0, CLOSED: 0 }
  for (const g of grouped) if (g.status in counts) counts[g.status as keyof TicketCounts] = g._count._all
  return {
    counts,
    tickets: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      email: r.email,
      category: r.category,
      subject: r.subject,
      preview: r.message.slice(0, 160),
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      repliedAt: r.repliedAt?.toISOString() ?? null,
      member: r.userId ? members.get(r.userId) ?? null : null,
    })),
  }
}

export async function membersById(ids: string[]) {
  const unique = [...new Set(ids)]
  const rows = unique.length
    ? await db.user.findMany({ where: { id: { in: unique } }, select: { id: true, username: true, profile: { select: { displayName: true } } } })
    : []
  return new Map(rows.map((u) => [u.id, { username: u.username, displayName: u.profile?.displayName ?? null }]))
}
