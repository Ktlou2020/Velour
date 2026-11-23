/**
 * Comments on Gallery photos (server only).
 *
 * - Anyone who can see a photo in the Gallery (lib/explore.ts
 *   exploreEligibleWhere) can comment, including the owner. Comments between
 *   members who have blocked each other are hidden from each of them.
 * - Comments are public, so the message screen (lib/message-screen.ts) runs
 *   first: contact details, threats, scams and harassment are refused, never
 *   posted.
 * - The author, the photo's owner and admins can delete a comment.
 * - The owner hears about new comments: one in-app notification per photo
 *   while unread, and at most one push per 10 minutes.
 */
import { db } from '@/lib/db'
import { exploreEligibleWhere } from '@/lib/explore'
import { screenMessage } from '@/lib/message-screen'
import { sendPushToUser } from '@/lib/push'

export const COMMENT_MAX = 500
export const COMMENTS_PAGE = 30
export const PHOTO_COMMENT_TYPE = 'PHOTO_COMMENT'
const PUSH_WINDOW_MS = 10 * 60 * 1000
const recentPush = new Map<string, number>()

export interface PhotoCommentDTO {
  id: string
  body: string
  createdAt: string
  author: { username: string; name: string; avatarUrl: string | null; isVerified: boolean; isPhotoOwner: boolean }
  isMine: boolean
  canDelete: boolean
}

/** Why a comment can't be posted, or null when it's fine. */
export function commentProblem(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return 'Write a comment first'
  if (raw.trim().length > COMMENT_MAX) return `Comments can be up to ${COMMENT_MAX} characters`
  const hit = screenMessage(raw)
  if (!hit) return null
  if (hit.categories.length === 1 && hit.categories[0] === 'CONTACT') {
    return 'Numbers, emails and social handles can’t go in public comments — send a private message instead.'
  }
  return 'This comment can’t be posted. Please keep comments kind and respectful.'
}

/** The photo, if this member may see (and so comment on) it. */
export async function findCommentablePhoto(viewerId: string, photoId: string) {
  return db.photo.findFirst({
    where: { AND: [{ id: photoId }, exploreEligibleWhere(viewerId)] },
    select: { id: true, userId: true, caption: true },
  })
}

function blockFilter(viewerId: string) {
  return {
    user: {
      isActive: true,
      blocksGiven: { none: { blockedId: viewerId } },
      blocksReceived: { none: { blockerId: viewerId } },
    },
  }
}

export async function listComments(opts: { viewerId: string; isAdmin: boolean; photo: { id: string; userId: string }; before?: Date }) {
  const { viewerId, isAdmin, photo, before } = opts
  const rows = await db.photoComment.findMany({
    where: { photoId: photo.id, ...blockFilter(viewerId), ...(before ? { createdAt: { lt: before } } : {}) },
    // Newest first for paging; the client shows them oldest → newest.
    orderBy: { createdAt: 'desc' },
    take: COMMENTS_PAGE + 1,
    select: {
      id: true, body: true, createdAt: true, userId: true,
      user: { select: { username: true, isVerified: true, profile: { select: { displayName: true, profilePhoto: true } } } },
    },
  })
  const hasMore = rows.length > COMMENTS_PAGE
  const page = rows.slice(0, COMMENTS_PAGE)
  const comments: PhotoCommentDTO[] = page.reverse().map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    author: {
      username: r.user.username,
      name: r.user.profile?.displayName || r.user.username,
      avatarUrl: r.user.profile?.profilePhoto ?? null,
      isVerified: r.user.isVerified,
      isPhotoOwner: r.userId === photo.userId,
    },
    isMine: r.userId === viewerId,
    canDelete: r.userId === viewerId || photo.userId === viewerId || isAdmin,
  }))
  return { comments, hasMore, before: hasMore ? page[0].createdAt.toISOString() : null }
}

export async function addComment(photo: { id: string; userId: string; caption: string | null }, authorId: string, text: string) {
  const body = text.trim().slice(0, COMMENT_MAX)
  const comment = await db.$transaction(async (tx) => {
    const c = await tx.photoComment.create({ data: { photoId: photo.id, userId: authorId, body } })
    await tx.photo.update({ where: { id: photo.id }, data: { commentCount: { increment: 1 } } })
    return c
  })
  if (photo.userId !== authorId) {
    await notifyComment({ ownerId: photo.userId, photoId: photo.id, authorId, body }).catch((e) =>
      console.error('photo comment notification failed:', e instanceof Error ? e.message : e),
    )
  }
  return comment
}

/** Deletes when allowed. Returns 'deleted', 'forbidden' or 'missing'. */
export async function deleteComment(commentId: string, by: { id: string; isAdmin: boolean }): Promise<'deleted' | 'forbidden' | 'missing'> {
  const c = await db.photoComment.findUnique({ where: { id: commentId }, select: { id: true, userId: true, photoId: true, photo: { select: { userId: true } } } })
  if (!c) return 'missing'
  if (c.userId !== by.id && c.photo.userId !== by.id && !by.isAdmin) return 'forbidden'
  await db.$transaction(async (tx) => {
    const del = await tx.photoComment.deleteMany({ where: { id: c.id } })
    if (del.count > 0) await tx.photo.updateMany({ where: { id: c.photoId, commentCount: { gt: 0 } }, data: { commentCount: { decrement: 1 } } })
  })
  return 'deleted'
}

async function notifyComment(opts: { ownerId: string; photoId: string; authorId: string; body: string }) {
  const { ownerId, photoId, authorId, body } = opts
  const author = await db.user.findUnique({ where: { id: authorId }, select: { username: true, profile: { select: { displayName: true } } } })
  const name = author?.profile?.displayName || author?.username || 'Someone'
  const url = `/gallery/explore?photo=${photoId}&comments=1`
  const snippet = `“${body.slice(0, 80)}${body.length > 80 ? '…' : ''}”`

  // One unread notification per photo, refreshed as more people comment.
  const existing = await db.notification.findFirst({
    where: { userId: ownerId, type: PHOTO_COMMENT_TYPE, isRead: false, data: { path: ['photoId'], equals: photoId } },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) {
    const d = (existing.data && typeof existing.data === 'object' ? existing.data : {}) as Record<string, unknown>
    const count = (typeof d.count === 'number' ? d.count : 1) + 1
    await db.notification.update({
      where: { id: existing.id },
      data: { title: `${name} and ${count - 1} other${count - 1 === 1 ? '' : 's'} commented on your photo`, body: snippet, createdAt: new Date(), data: { ...d, url, photoId, count } },
    })
  } else {
    await db.notification.create({
      data: { userId: ownerId, type: PHOTO_COMMENT_TYPE, title: `${name} commented on your photo`, body: snippet, data: { url, photoId, count: 1 } },
    })
  }

  const now = Date.now()
  const last = recentPush.get(ownerId)
  if (last && now - last < PUSH_WINDOW_MS) return
  recentPush.set(ownerId, now)
  if (recentPush.size > 10_000) recentPush.clear()
  sendPushToUser(ownerId, { title: `${name} commented on your photo`, body: snippet, url, tag: `photo-comment-${photoId}` }).catch(() => {})
}
