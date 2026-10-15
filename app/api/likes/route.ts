import { NextRequest, NextResponse } from 'next/server'
import { EMAIL_UNVERIFIED_ERROR, hasConfirmedEmail } from '@/lib/email-verification'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'
import { findMatchesBetween, getPartnerMap, isBlockedBetween, sideOf } from '@/lib/couples'
import { entitlements, startOfDaySAST } from '@/lib/plans'
import { getBlockedIds, getCallerContext, memberSelect, toMemberResult } from '@/app/api/members/search'
import {
  countLikesToday, countSuperLikesInPeriod, dayResetsAt, getAllowance, loadPlan, superLikeResetsAt,
} from './limits'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await hasConfirmedEmail(session.user.id))) {
      return NextResponse.json({ error: EMAIL_UNVERIFIED_ERROR, code: 'EMAIL_UNVERIFIED' }, { status: 403 })
    }

    const body = await req.json()
    const { toUserId: rawToUserId, targetUsername, type: rawType = 'LIKE' } = body as {
      toUserId?: string
      targetUsername?: string
      type?: string
    }

    // Normalise SUPER_LIKE → SUPERLIKE
    const type = rawType === 'SUPER_LIKE' ? 'SUPERLIKE' : rawType as 'LIKE' | 'SUPERLIKE' | 'WINK' | 'PASS'

    // Resolve targetUsername → userId if toUserId not provided
    let toUserId = rawToUserId
    if (!toUserId && targetUsername) {
      const target = await db.user.findUnique({ where: { username: targetUsername }, select: { id: true } })
      if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
      toUserId = target.id
    }

    if (!toUserId) {
      return NextResponse.json({ error: 'toUserId or targetUsername is required' }, { status: 400 })
    }

    if (toUserId === session.user.id) {
      return NextResponse.json({ error: 'Cannot like yourself' }, { status: 400 })
    }

    const validTypes = ['LIKE', 'SUPERLIKE', 'WINK', 'PASS']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid like type' }, { status: 400 })
    }

    const userId = session.user.id
    const target = await db.user.findUnique({ where: { id: toUserId }, select: { id: true, isActive: true } })
    if (!target || !target.isActive) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const now = new Date()
    const plan = await loadPlan(userId)
    const existing = await db.like.findUnique({
      where: { fromUserId_toUserId: { fromUserId: userId, toUserId } },
      select: { type: true, createdAt: true },
    })

    // Repeating the same action is a no-op: it must not spend allowance or
    // move the like into today's count.
    const repeat = !!existing && existing.type === type
    if (!repeat) {
      // Daily like allowance (LIKE / WINK / SUPERLIKE count; PASS never does).
      // A row that already counts today (e.g. LIKE → WINK) doesn't count twice.
      // Super likes have their own allowance and are never blocked by this cap.
      const alreadyCountedToday = !!existing && existing.type !== 'PASS' && existing.createdAt >= startOfDaySAST(now)
      if (type !== 'PASS' && type !== 'SUPERLIKE' && plan.ent.likesPerDay !== null && !alreadyCountedToday) {
        const used = await countLikesToday(userId, now)
        if (used >= plan.ent.likesPerDay) {
          return NextResponse.json({
            error: `You've used today's ${plan.ent.likesPerDay} likes. They refresh at midnight.`,
            code: 'LIKE_LIMIT',
            limit: plan.ent.likesPerDay,
            resetsAt: dayResetsAt(now).toISOString(),
            upgrade: true,
            allowance: await getAllowance(userId),
          }, { status: 429 })
        }
      }

      // Super likes: the plan's period allowance first, then bonus credits.
      if (type === 'SUPERLIKE') {
        const used = await countSuperLikesInPeriod(userId, plan.ent, now)
        if (used >= plan.ent.superLikes) {
          const spent = await db.user.updateMany({
            where: { id: userId, superLikeCredits: { gt: 0 } },
            data: { superLikeCredits: { decrement: 1 } },
          })
          if (spent.count === 0) {
            const period = plan.ent.superLikePeriod === 'day' ? 'today' : 'this week'
            return NextResponse.json({
              error: `You've used your super likes for ${period}. ${plan.ent.superLikePeriod === 'day' ? 'A new one arrives at midnight' : 'More arrive on Monday'} — or keep your login streak going to earn bonus ones.`,
              code: 'SUPERLIKE_LIMIT',
              limit: plan.ent.superLikes,
              period: plan.ent.superLikePeriod,
              resetsAt: superLikeResetsAt(plan.ent, now).toISOString(),
              upgrade: plan.tier !== 'PLATINUM',
              allowance: await getAllowance(userId),
            }, { status: 429 })
          }
        }
      }

      await db.like.upsert({
        where: { fromUserId_toUserId: { fromUserId: userId, toUserId } },
        update: { type, createdAt: now },
        create: { fromUserId: userId, toUserId, type },
      })
    }

    const allowance = await getAllowance(userId)

    // Passes don't create matches
    if (type === 'PASS') {
      return NextResponse.json({ passed: true, matched: false, allowance })
    }

    // Linked couples like as one: a like from either partner counts for the couple.
    const partnerMap = await getPartnerMap([session.user.id, toUserId])
    const mySide = sideOf(session.user.id, partnerMap)
    const theirSide = sideOf(toUserId, partnerMap)
    const sameCouple = mySide.includes(toUserId)

    // Check for mutual like (anyone on their side → anyone on mine)
    const mutualLike = sameCouple ? null : await db.like.findFirst({
      where: {
        fromUserId: { in: theirSide },
        toUserId: { in: mySide },
        type: { not: 'PASS' },
      },
    })
    const blocked = mutualLike ? await isBlockedBetween(mySide, theirSide) : false

    let matched = false

    if (mutualLike && !blocked) {
      const [user1Id, user2Id] =
        session.user.id < toUserId
          ? [session.user.id, toUserId]
          : [toUserId, session.user.id]

      // Already matched with this person or their partner?
      const existingMatch = (await findMatchesBetween(mySide, theirSide))[0] ?? null

      if (!existingMatch) {
        const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        await db.match.create({ data: { user1Id, user2Id, expiresAt: sevenDays } })

        // Notify everyone on both sides (both partners of a linked couple).
        // Deep link to the chat when one already exists between the sides.
        const meId = session.user.id
        const existingConv = await db.conversation.findFirst({
          where: {
            AND: [
              { participants: { some: { userId: { in: mySide } } } },
              { participants: { some: { userId: { in: theirSide } } } },
            ],
          },
          orderBy: { lastMessageAt: 'desc' },
          select: { id: true },
        })
        const names = await db.user.findMany({
          where: { id: { in: [meId, toUserId] } },
          select: { id: true, username: true, profile: { select: { displayName: true } } },
        })
        const nameOf = (id: string) => {
          const u = names.find((x) => x.id === id)
          return u?.profile?.displayName || u?.username || 'someone'
        }
        const usernameOf = (id: string) => names.find((x) => x.id === id)?.username ?? ''
        const matchUrl = existingConv ? `/messages?conv=${existingConv.id}` : '/matches'
        const notify = [
          ...mySide.map((u) => ({ userId: u, matchedUserId: toUserId })),
          ...theirSide.map((u) => ({ userId: u, matchedUserId: meId })),
        ]
        await db.notification.createMany({
          data: notify.map((n) => ({
            userId: n.userId,
            type: 'MATCH',
            title: "It's a Match!",
            body: `You and ${nameOf(n.matchedUserId)} liked each other — say hi before the match expires.`,
            data: {
              matchedUserId: n.matchedUserId,
              matchedUsername: usernameOf(n.matchedUserId),
              url: matchUrl,
              ...(existingConv ? { conversationId: existingConv.id } : {}),
            },
          })),
        })

        for (const n of notify) {
          sendPushToUser(n.userId, { title: "It's a Match! 🎉", body: `You and ${nameOf(n.matchedUserId)} liked each other on Unbound`, url: matchUrl, tag: `match-${user1Id}-${user2Id}` }).catch(() => {})
        }
        matched = true
      } else {
        matched = true
      }
    }

    // In-app notification + push for a plain like / wink / super like (not for a
    // repeated tap, a match — that has its own — or across a block). Names are
    // only shown to members whose plan can see who liked them.
    if (!matched && !repeat && !sameCouple && !(await isBlockedBetween(mySide, theirSide))) {
      try {
        const [liker, owner] = await Promise.all([
          db.user.findUnique({ where: { id: userId }, select: { username: true, profile: { select: { displayName: true } } } }),
          db.user.findUnique({ where: { id: toUserId }, select: { role: true, profile: { select: { membershipTier: true } } } }),
        ])
        const canSee = !!owner && entitlements(owner.profile?.membershipTier, owner.role).seeWhoLikedYou
        const who = canSee ? (liker?.profile?.displayName || liker?.username || 'Someone') : 'Someone'
        const copy: Record<string, { title: string; body: string }> = {
          LIKE: { title: `${who} liked you`, body: canSee ? 'Like them back for an instant match.' : 'Upgrade to Gold to see who — or keep swiping in Discover.' },
          SUPERLIKE: { title: `${who} super liked you ⭐`, body: canSee ? 'They really want to meet you. Like them back for an instant match.' : 'Someone really wants to meet you. Upgrade to Gold to see who.' },
          WINK: { title: `${who} winked at you 😉`, body: canSee ? 'Wink back or say hi.' : 'Upgrade to Gold to see who.' },
        }
        const c = copy[type] ?? copy.LIKE
        await db.notification.create({
          data: {
            userId: toUserId,
            type,
            title: c.title,
            body: c.body,
            data: { url: '/matches#liked-you', fromUserId: userId, ...(canSee && liker ? { fromUsername: liker.username } : {}) },
          },
        })
        sendPushToUser(toUserId, {
          title: `${c.title} — Unbound`,
          body: c.body,
          url: '/matches#liked-you',
          tag: `like-${userId}`,
        }).catch(() => {})
      } catch (e) {
        console.error('like notification failed:', e instanceof Error ? e.message : e)
      }
    }

    return NextResponse.json({ liked: true, matched, allowance })
  } catch (error) {
    console.error('POST /api/likes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/likes — people who liked (or winked / super liked) the caller and
 * whom the caller hasn't responded to yet. Blocked and deactivated members
 * are excluded.
 *   Gold+ → { locked: false, count, superCount, likes: [{ id, type, createdAt, member }] }
 *   Free  → { locked: true, count, superCount, likes: [] } — the count sells the
 *           upgrade; no names or photos are sent to the client.
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const plan = await loadPlan(userId)

    const [blockedIds, myActions] = await Promise.all([
      getBlockedIds(userId),
      db.like.findMany({ where: { fromUserId: userId }, select: { toUserId: true } }),
    ])
    const excluded = [...blockedIds, ...myActions.map((a) => a.toUserId)]
    const where = {
      toUserId: userId,
      type: { not: 'PASS' as const },
      fromUserId: { notIn: excluded },
      fromUser: { isActive: true },
    }

    const [count, superCount] = await Promise.all([
      db.like.count({ where }),
      db.like.count({ where: { ...where, type: 'SUPERLIKE' as const } }),
    ])

    if (!plan.ent.seeWhoLikedYou) {
      return NextResponse.json({ locked: true, count, superCount, likes: [] })
    }

    const rows = await db.like.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 60,
      select: { id: true, type: true, createdAt: true, fromUser: { select: memberSelect } },
    })
    const caller = await getCallerContext(userId, plan.role ?? undefined)
    const likes = rows
      // Super likes first, then newest
      .sort((a, b) => Number(b.type === 'SUPERLIKE') - Number(a.type === 'SUPERLIKE') || b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => ({ id: r.id, type: r.type, createdAt: r.createdAt, member: toMemberResult(r.fromUser, caller) }))

    return NextResponse.json({ locked: false, count, superCount, likes })
  } catch (error) {
    console.error('GET /api/likes error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
