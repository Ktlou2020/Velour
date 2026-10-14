import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import {
  blockedAcross,
  coupleDisplayName,
  getBlockPairs,
  getCoupleMemberNames,
  getPartnerMap,
  sideOf,
} from '@/lib/couples'

const userSelect = {
  id: true,
  username: true,
  profile: {
    select: {
      displayName: true,
      profilePhoto: true,
      city: true,
      country: true,
      gender: true,
      isOnline: true,
      lastSeen: true,
      isCouple: true,
      coupleMembers: true,
    },
  },
} as const

/**
 * Matches of the caller OR their linked partner — a linked couple shares its
 * matches. Each entry says who on the caller's side matched (`matchedVia`).
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const myMap = await getPartnerMap([userId])
    const mySide = sideOf(userId, myMap)

    const matches = await db.match.findMany({
      where: {
        OR: [{ user1Id: { in: mySide } }, { user2Id: { in: mySide } }],
      },
      include: { user1: { select: userSelect }, user2: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
    })

    // Couple info + blocks for the people on the other side
    const otherIds = new Set<string>()
    for (const m of matches) {
      if (!mySide.includes(m.user1Id)) otherIds.add(m.user1Id)
      if (!mySide.includes(m.user2Id)) otherIds.add(m.user2Id)
    }
    const partnerMap = await getPartnerMap(Array.from(otherIds))
    const partnerIds = Array.from(new Set(Array.from(otherIds).map((u) => partnerMap.get(u)).filter((u): u is string => !!u)))
    const [partners, blockPairs] = await Promise.all([
      partnerIds.length
        ? db.user.findMany({
            where: { id: { in: partnerIds } },
            select: { id: true, username: true, profile: { select: { displayName: true } } },
          })
        : Promise.resolve([]),
      getBlockPairs([...mySide, ...Array.from(otherIds), ...partnerIds]),
    ])
    const partnerName = new Map(partners.map((p) => [p.id, p.profile?.displayName || p.username]))

    // Return matches with the "other" user surfaced.
    // expiresAt is set on match creation and cleared when the first message
    // is sent; a past expiresAt means the match lapsed without a hello.
    const now = Date.now()
    const seen = new Map<string, number>()
    const formattedMatches: Record<string, unknown>[] = []
    for (const match of matches) {
      // A match between the two partners themselves isn't shown
      if (mySide.includes(match.user1Id) && mySide.includes(match.user2Id)) continue
      const viaUser = mySide.includes(match.user1Id) ? match.user1 : match.user2
      const otherUser = viaUser.id === match.user1Id ? match.user2 : match.user1

      const theirSide = sideOf(otherUser.id, partnerMap)
      if (blockedAcross(mySide, theirSide, blockPairs)) continue

      const expired = !!match.expiresAt && match.expiresAt.getTime() < now
      const otherName = otherUser.profile?.displayName || otherUser.username
      const linkedPartner = partnerMap.get(otherUser.id)
      const sharedNames = otherUser.profile?.isCouple ? getCoupleMemberNames(otherUser.profile.coupleMembers) : []
      const coupleLabel = linkedPartner
        ? coupleDisplayName([otherName, partnerName.get(linkedPartner)])
        : sharedNames.length >= 2 ? coupleDisplayName(sharedNames) : null

      const { coupleMembers: _cm, ...profile } = otherUser.profile ?? ({} as NonNullable<typeof otherUser.profile>)
      void _cm
      const entry = {
        id: match.id,
        createdAt: match.createdAt,
        expiresAt: match.expiresAt,
        expired,
        otherUser: { id: otherUser.id, username: otherUser.username, profile: otherUser.profile ? profile : null },
        couple: coupleLabel ? { label: coupleLabel, kind: linkedPartner ? 'linked' : 'shared' } : null,
        matchedVia: {
          id: viaUser.id,
          name: viaUser.profile?.displayName || viaUser.username,
          isMe: viaUser.id === userId,
        },
      }

      // Same person/couple matched more than once across partners → one card
      // (prefer active, then my own match)
      const sideKey = [...theirSide].sort().join('|')
      const prevIdx = seen.get(sideKey)
      if (prevIdx !== undefined) {
        const prev = formattedMatches[prevIdx] as typeof entry
        const better = (prev.expired && !expired) || (prev.expired === expired && !prev.matchedVia.isMe && entry.matchedVia.isMe)
        if (better) formattedMatches[prevIdx] = entry
        continue
      }
      seen.set(sideKey, formattedMatches.length)
      formattedMatches.push(entry)
    }

    return NextResponse.json({ matches: formattedMatches, inCouple: mySide.length > 1 })
  } catch (error) {
    console.error('GET /api/matches error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
