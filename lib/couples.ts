import { db } from '@/lib/db'

/**
 * Couples & shared conversations.
 *
 * Two kinds of couple exist:
 *  (A) Linked accounts — two users whose Profiles have isCouple=true and
 *      partnerId pointing at each other. A one-sided/partial link is NOT a link.
 *  (B) Shared account — one login for both people: Profile.isCouple=true,
 *      no partner link, Profile.coupleMembers = [{ name, ... }, { name, ... }].
 *
 * Conversations with a linked couple include BOTH partners as participants.
 * Partners are added lazily (on list/open/start) so conversations that existed
 * before the link pick the new partner up.
 *
 * Unlink rule (no schema involved): the two earliest ConversationParticipant
 * rows of a conversation (cuid ids sort by creation time) are its "principals"
 * — the people the conversation was started between. Partners are always
 * inserted after the principals in a separate statement. Whenever a
 * conversation is synced, any NON-principal participant who is no longer
 * partner-linked to another participant is removed: they were only there
 * because of a link that no longer exists. Their old messages stay in the
 * thread (attributed to them); they simply lose access. Principals are never
 * removed, so a conversation never drops below its original two people.
 */

export interface CoupleMember { name: string }

/** Names from Profile.coupleMembers (shared couple account), trimmed, max 2. */
export function getCoupleMemberNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const m of raw) {
    const name = m && typeof m === 'object' && typeof (m as { name?: unknown }).name === 'string'
      ? (m as { name: string }).name.trim().slice(0, 40)
      : ''
    if (name && !out.includes(name)) out.push(name)
    if (out.length === 2) break
  }
  return out
}

/** "Thandi & Sipho" (falls back gracefully for one/zero names). */
export function coupleDisplayName(names: (string | null | undefined)[]): string {
  const clean = names.map((n) => (n ?? '').trim()).filter(Boolean)
  if (clean.length === 0) return ''
  if (clean.length === 1) return clean[0]
  return `${clean[0]} & ${clean[1]}`
}

/**
 * userId → linked partner's userId, for every user in `userIds` that has a
 * mutual, active couple link (both entries are added: A→B and B→A).
 */
export async function getPartnerMap(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (ids.length === 0) return map
  const profiles = await db.profile.findMany({
    where: { userId: { in: ids }, isCouple: true, partnerId: { not: null } },
    select: {
      id: true,
      userId: true,
      partner: { select: { id: true, userId: true, partnerId: true, isCouple: true } },
    },
  })
  for (const p of profiles) {
    const partner = p.partner
    if (partner && partner.isCouple && partner.partnerId === p.id && partner.userId !== p.userId) {
      map.set(p.userId, partner.userId)
      map.set(partner.userId, p.userId)
    }
  }
  return map
}

/** The linked partner's userId(s) — [] when not in a linked couple. */
export async function getPartnerIds(userId: string): Promise<string[]> {
  const map = await getPartnerMap([userId])
  const p = map.get(userId)
  return p ? [p] : []
}

/** The user plus their linked partner (if any). */
export function sideOf(userId: string, partnerMap: Map<string, string>): string[] {
  const p = partnerMap.get(userId)
  return p ? [userId, p] : [userId]
}

/** True if anyone in `a` blocked anyone in `b`, or vice versa. */
export async function isBlockedBetween(a: string[], b: string[]): Promise<boolean> {
  if (a.length === 0 || b.length === 0) return false
  const block = await db.block.findFirst({
    where: {
      OR: [
        { blockerId: { in: a }, blockedId: { in: b } },
        { blockerId: { in: b }, blockedId: { in: a } },
      ],
    },
    select: { id: true },
  })
  return !!block
}

/** All blocks touching any of the given users, as "blocker|blocked" keys. */
export async function getBlockPairs(userIds: string[]): Promise<Set<string>> {
  const ids = Array.from(new Set(userIds))
  const set = new Set<string>()
  if (ids.length === 0) return set
  const blocks = await db.block.findMany({
    where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] },
    select: { blockerId: true, blockedId: true },
  })
  for (const b of blocks) set.add(`${b.blockerId}|${b.blockedId}`)
  return set
}

export function blockedAcross(a: string[], b: string[], pairs: Set<string>): boolean {
  for (const x of a) for (const y of b) {
    if (pairs.has(`${x}|${y}`) || pairs.has(`${y}|${x}`)) return true
  }
  return false
}

// ── Conversation membership ────────────────────────────────────────────────

export interface ParticipantRow { id: string; userId: string }

/** Group participant userIds into "sides": each side is a person or a linked couple. */
export function groupSides(userIds: string[], partnerMap: Map<string, string>): string[][] {
  const present = new Set(userIds)
  const seen = new Set<string>()
  const sides: string[][] = []
  for (const u of userIds) {
    if (seen.has(u)) continue
    seen.add(u)
    const p = partnerMap.get(u)
    if (p && present.has(p) && !seen.has(p)) {
      seen.add(p)
      sides.push([u, p])
    } else {
      sides.push([u])
    }
  }
  return sides
}

/** The two principals: the earliest two participant rows (cuid ids sort by time). */
export function principalsOf(rows: ParticipantRow[]): Set<string> {
  const sorted = [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return new Set(sorted.slice(0, 2).map((r) => r.userId))
}

export interface SyncResult {
  /** userIds of participants after the sync */
  userIds: string[]
  added: string[]
  removed: string[]
  /** A block exists between people on different sides (incl. partners not yet added). */
  blocked: boolean
}

/**
 * Bring a conversation's participants in line with current couple links:
 * remove ex-partners (see unlink rule at top), add missing linked partners.
 * `partnerMap` must cover every participant; `blockPairs` every participant
 * and their partners.
 */
export async function syncConversation(
  conversationId: string,
  rows: ParticipantRow[],
  partnerMap: Map<string, string>,
  blockPairs: Set<string>,
): Promise<SyncResult> {
  const principals = principalsOf(rows)
  // Join order (cuid ids sort by time): principals first, so labels are stable
  let current = [...rows].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)).map((r) => r.userId)
  const removed: string[] = []

  // 1. Remove non-principals who aren't linked to anyone still in the conversation.
  //    Iterate until stable (removing one may orphan another).
  let changed = true
  while (changed) {
    changed = false
    for (const u of current) {
      if (principals.has(u)) continue
      const p = partnerMap.get(u)
      if (!p || !current.includes(p)) {
        current = current.filter((x) => x !== u)
        removed.push(u)
        changed = true
        break
      }
    }
  }

  // 2. Work out sides from the principals' (and remaining members') links.
  const sides = groupSides(current, partnerMap)
  const expandedSides = sides.map((s) => {
    const out = [...s]
    for (const u of s) {
      const p = partnerMap.get(u)
      if (p && !out.includes(p)) out.push(p)
    }
    return out
  })

  let blocked = false
  for (let i = 0; i < expandedSides.length && !blocked; i++) {
    for (let j = i + 1; j < expandedSides.length && !blocked; j++) {
      if (blockedAcross(expandedSides[i], expandedSides[j], blockPairs)) blocked = true
    }
  }

  // 3. Add linked partners who are missing (never into a blocked conversation).
  const added: string[] = []
  if (!blocked) {
    for (const u of [...current]) {
      const p = partnerMap.get(u)
      if (p && !current.includes(p) && !added.includes(p)) added.push(p)
    }
  }

  if (removed.length > 0) {
    await db.conversationParticipant.deleteMany({
      where: { conversationId, userId: { in: removed } },
    })
  }
  if (added.length > 0) {
    await db.conversationParticipant.createMany({
      data: added.map((userId) => ({ conversationId, userId })),
      skipDuplicates: true,
    })
    current = [...current, ...added]
  }
  if (removed.length > 0 || added.length > 0) {
    // Wake open streams so clients refresh the participant list
    await db.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }).catch(() => {})
  }

  return { userIds: current, added, removed, blocked }
}

/** Load + sync one conversation. Returns null if it doesn't exist. */
export async function syncConversationById(conversationId: string): Promise<SyncResult | null> {
  const rows = await db.conversationParticipant.findMany({
    where: { conversationId },
    select: { id: true, userId: true },
  })
  if (rows.length === 0) return null
  const partnerMap = await getPartnerMap(rows.map((r) => r.userId))
  const everyone = new Set(rows.map((r) => r.userId))
  partnerMap.forEach((v) => everyone.add(v))
  const blockPairs = await getBlockPairs(Array.from(everyone))
  return syncConversation(conversationId, rows, partnerMap, blockPairs)
}

/**
 * Verify access to a conversation for `userId` (after a lazy sync).
 * Returns null when the user is not (or no longer) a participant.
 */
export async function getConversationAccess(conversationId: string, userId: string) {
  const res = await syncConversationById(conversationId)
  if (!res || !res.userIds.includes(userId)) return null
  return res
}

export type FindOrCreateResult =
  | { ok: true; conversationId: string; created: boolean }
  | { ok: false; reason: 'blocked' }

/**
 * Find the conversation between `meId`'s side and `otherId`'s side (each side
 * being a person plus their linked partner), syncing it; or create it with
 * everyone on both sides. Principals (me, other) are inserted first.
 */
export async function findOrCreateConversation(meId: string, otherId: string): Promise<FindOrCreateResult> {
  const partnerMap = await getPartnerMap([meId, otherId])
  const mySide = sideOf(meId, partnerMap)
  const otherSide = sideOf(otherId, partnerMap)

  // Partners messaging each other: a plain two-person conversation.
  if (mySide.includes(otherId)) {
    const existing = await db.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: meId } } },
          { participants: { some: { userId: otherId } } },
          { participants: { every: { userId: { in: [meId, otherId] } } } },
        ],
      },
      select: { id: true },
    })
    if (existing) return { ok: true, conversationId: existing.id, created: false }
    const conv = await db.conversation.create({
      data: { participants: { create: [{ userId: meId }, { userId: otherId }] } },
      select: { id: true },
    })
    return { ok: true, conversationId: conv.id, created: true }
  }

  const everyone = Array.from(new Set([...mySide, ...otherSide]))
  if (await isBlockedBetween(mySide, otherSide)) return { ok: false, reason: 'blocked' }

  const candidates = await db.conversation.findMany({
    where: {
      AND: [
        { participants: { some: { userId: { in: mySide } } } },
        { participants: { some: { userId: { in: otherSide } } } },
      ],
    },
    select: {
      id: true,
      lastMessageAt: true,
      participants: { select: { id: true, userId: true } },
    },
    take: 20,
  })

  if (candidates.length > 0) {
    const allIds = new Set<string>(everyone)
    for (const c of candidates) for (const p of c.participants) allIds.add(p.userId)
    const fullMap = await getPartnerMap(Array.from(allIds))
    fullMap.forEach((v) => allIds.add(v))
    const blockPairs = await getBlockPairs(Array.from(allIds))

    const usable: { id: string; hasMe: boolean; lastMessageAt: Date | null }[] = []
    for (const c of candidates) {
      const res = await syncConversation(c.id, c.participants, fullMap, blockPairs)
      const inSet = res.userIds.every((u) => everyone.includes(u))
      const hasMine = res.userIds.some((u) => mySide.includes(u))
      const hasOther = res.userIds.some((u) => otherSide.includes(u))
      if (inSet && hasMine && hasOther) {
        usable.push({ id: c.id, hasMe: res.userIds.includes(meId), lastMessageAt: c.lastMessageAt })
      }
    }
    usable.sort((a, b) =>
      Number(b.hasMe) - Number(a.hasMe) ||
      (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0))
    const best = usable[0]
    if (best) {
      if (!best.hasMe) {
        // Can only happen if sync didn't add me (shouldn't, since not blocked) — add explicitly
        await db.conversationParticipant.createMany({
          data: [{ conversationId: best.id, userId: meId }],
          skipDuplicates: true,
        })
      }
      return { ok: true, conversationId: best.id, created: false }
    }
  }

  // Create: principals first, partners in a second statement (see unlink rule).
  const conv = await db.conversation.create({
    data: { participants: { create: [{ userId: meId }, { userId: otherId }] } },
    select: { id: true },
  })
  const partners = everyone.filter((u) => u !== meId && u !== otherId)
  if (partners.length > 0) {
    await db.conversationParticipant.createMany({
      data: partners.map((userId) => ({ conversationId: conv.id, userId })),
      skipDuplicates: true,
    })
  }
  return { ok: true, conversationId: conv.id, created: true }
}

// ── Matches across couples ──────────────────────────────────────────────────

/** Matches between anyone on side A and anyone on side B. */
export async function findMatchesBetween(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) return []
  return db.match.findMany({
    where: {
      OR: [
        { user1Id: { in: a }, user2Id: { in: b } },
        { user1Id: { in: b }, user2Id: { in: a } },
      ],
    },
    select: { id: true, user1Id: true, user2Id: true, expiresAt: true },
  })
}

/**
 * Effective expiry for a conversation between two sides: null if there is no
 * match, or any match between them is permanent (expiresAt cleared).
 * Otherwise the latest expiresAt.
 */
export function effectiveExpiry(matches: { expiresAt: Date | null }[]): Date | null {
  if (matches.length === 0) return null
  let latest: Date | null = null
  for (const m of matches) {
    if (!m.expiresAt) return null
    if (!latest || m.expiresAt > latest) latest = m.expiresAt
  }
  return latest
}

// ── Display helpers ────────────────────────────────────────────────────────

export interface PersonInfo {
  id: string
  username: string
  name: string
  photo: string | null
  isOnline: boolean
  lastSeen: Date | null
  /** Shared couple account: the two people's names */
  coupleNames: string[]
  isCouple: boolean
  city: string | null
}

export const personSelect = {
  id: true,
  username: true,
  profile: {
    select: {
      displayName: true,
      profilePhoto: true,
      isOnline: true,
      lastSeen: true,
      isCouple: true,
      coupleMembers: true,
      city: true,
      incognito: true,
    },
  },
} as const

type PersonRow = {
  id: string
  username: string
  profile: {
    displayName: string | null
    profilePhoto: string | null
    isOnline: boolean
    lastSeen: Date
    isCouple: boolean
    coupleMembers: unknown
    city: string | null
    incognito?: boolean
  } | null
}

export function toPerson(u: PersonRow): PersonInfo {
  const names = u.profile?.isCouple ? getCoupleMemberNames(u.profile?.coupleMembers) : []
  return {
    id: u.id,
    username: u.username,
    name: u.profile?.displayName || u.username,
    photo: u.profile?.profilePhoto ?? null,
    isOnline: (u.profile?.isOnline ?? false) && !u.profile?.incognito,
    lastSeen: u.profile?.lastSeen ?? null,
    coupleNames: names.length >= 2 ? names : [],
    isCouple: !!u.profile?.isCouple,
    city: u.profile?.city ?? null,
  }
}

export async function loadPeople(userIds: string[]): Promise<Map<string, PersonInfo>> {
  const ids = Array.from(new Set(userIds))
  const map = new Map<string, PersonInfo>()
  if (ids.length === 0) return map
  const users = await db.user.findMany({ where: { id: { in: ids } }, select: personSelect })
  for (const u of users) map.set(u.id, toPerson(u as PersonRow))
  return map
}

export interface SideInfo {
  userIds: string[]
  /** "Thandi & Sipho" for couples, otherwise the person's name */
  label: string
  isCouple: boolean
  kind: 'single' | 'linked' | 'shared'
  members: { id: string; username: string; name: string; photo: string | null; isOnline: boolean }[]
}

/** Describe a side (one person, a linked pair, or a shared couple account). */
export function describeSide(userIds: string[], people: Map<string, PersonInfo>): SideInfo {
  const members = userIds
    .map((id) => people.get(id))
    .filter((p): p is PersonInfo => !!p)
    .map((p) => ({ id: p.id, username: p.username, name: p.name, photo: p.photo, isOnline: p.isOnline }))
  if (members.length >= 2) {
    return { userIds, label: coupleDisplayName(members.map((m) => m.name)), isCouple: true, kind: 'linked', members }
  }
  const p = people.get(userIds[0])
  if (p && p.coupleNames.length >= 2) {
    return { userIds, label: coupleDisplayName(p.coupleNames), isCouple: true, kind: 'shared', members }
  }
  return { userIds, label: members[0]?.name ?? 'Member', isCouple: false, kind: 'single', members }
}

// ── Typing names for shared couple accounts (best-effort, in-process) ──────

const TYPING_KEY = '__hushTypingAs'
type TypingStore = Map<string, { name: string; until: number }>
function typingStore(): TypingStore {
  const g = globalThis as unknown as Record<string, TypingStore | undefined>
  if (!g[TYPING_KEY]) g[TYPING_KEY] = new Map()
  return g[TYPING_KEY]!
}
export function setTypingAs(conversationId: string, userId: string, name: string | null, ttlMs: number) {
  const key = `${conversationId}:${userId}`
  if (name) typingStore().set(key, { name, until: Date.now() + ttlMs })
  else typingStore().delete(key)
}
export function getTypingAs(conversationId: string, userId: string): string | null {
  const v = typingStore().get(`${conversationId}:${userId}`)
  if (!v) return null
  if (v.until < Date.now()) { typingStore().delete(`${conversationId}:${userId}`); return null }
  return v.name
}

// ── Read receipts with several recipients ──────────────────────────────────

export interface Receipt {
  messageId: string
  /** userIds of other participants who have read the message */
  seenBy: string[]
  /** every other participant has read it */
  allSeen: boolean
  readAt: Date | null
}

/**
 * Per-recipient read state without a per-recipient table: a participant's
 * unreadCount is exactly the number of newest messages (not sent by them)
 * they haven't read, so message M is read by Q iff fewer than
 * unreadCount(Q)+1 messages not sent by Q are at least as new as M.
 */
export async function computeReceipt(
  conversationId: string,
  senderId: string,
  message?: { id: string; createdAt: Date; readAt: Date | null } | null,
): Promise<Receipt | null> {
  const m = message ?? await db.message.findFirst({
    where: { conversationId, senderId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, readAt: true },
  })
  if (!m) return null
  const others = await db.conversationParticipant.findMany({
    where: { conversationId, userId: { not: senderId } },
    select: { userId: true, unreadCount: true },
  })
  const seenBy: string[] = []
  await Promise.all(others.map(async (o) => {
    if (o.unreadCount === 0) { seenBy.push(o.userId); return }
    const rank = await db.message.count({
      where: { conversationId, senderId: { not: o.userId }, createdAt: { gte: m.createdAt } },
    })
    if (rank > o.unreadCount) seenBy.push(o.userId)
  }))
  seenBy.sort()
  return {
    messageId: m.id,
    seenBy,
    allSeen: others.length > 0 && seenBy.length === others.length,
    readAt: seenBy.length > 0 ? m.readAt : null,
  }
}
