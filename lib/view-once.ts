/**
 * View-once chat media (server only).
 *
 * A view-once message is a chat photo (imageUrl) or chat video (meta.videoUrl)
 * sent with Message.viewOnce = true. Rules:
 *   - Nobody gets a URL, thumbnail or poster for it in message payloads
 *     (redactViewOnce) — not even the sender.
 *   - Each recipient account (every conversation participant except the
 *     sender) may open it once: POST …/messages/<id>/open creates a
 *     MessageView with a short window (openUntil). /api/media/<id> serves the
 *     file only to a viewer inside that window (viewOnceGate), uncached.
 *   - Once every recipient has viewed it and the last window has ended, or
 *     14 days after sending, the stored files are deleted and mediaDeletedAt
 *     is set (sweepViewOnce: lazily on chat reads / after an open, and from
 *     the cron route /api/cron/view-once).
 */
import { db } from '@/lib/db'
import { CHAT_ALBUM_NAME, mediaIdFromUrl, mediaUrl } from '@/lib/media'
import { deleteFiles, photoFileKeys } from '@/lib/storage'
import { purgeWatermarks } from '@/lib/watermark'

export const VIEW_ONCE_TTL_MS = 14 * 24 * 60 * 60 * 1000
/** Server window for a photo (the viewer UI closes after PHOTO_VIEW_SEC). */
export const PHOTO_WINDOW_SEC = 15
export const PHOTO_VIEW_SEC = 10
/** Video: its length + slack, capped. */
export const VIDEO_SLACK_SEC = 15
export const VIDEO_MAX_WINDOW_SEC = 210

export const VIEW_ONCE_PHOTO_PREVIEW = '📸 View-once photo'
export const VIEW_ONCE_VIDEO_PREVIEW = '🎥 View-once video'

export type ViewOnceKind = 'photo' | 'video'

/** What a client learns about a view-once message (never the media URL). */
export interface ViewOnceInfo {
  kind: ViewOnceKind
  durationSec: number | null
  expiresAt: string | null
  /**
   * Recipient: sealed (can open) | opened (by me) | expired (never opened in time).
   * Sender: delivered (not everyone opened yet) | opened (every recipient) | expired.
   */
  state: 'sealed' | 'opened' | 'expired' | 'delivered'
  /** Recipient: when I opened it */
  openedAt?: string | null
  /** Sender only: who opened it and when */
  views?: { userId: string; viewedAt: string }[]
  /** Sender only: how many recipients there are */
  recipients?: number
}

type MsgLike = {
  id: string
  senderId: string
  kind?: string | null
  imageUrl?: string | null
  meta?: unknown
  viewOnce?: boolean | null
  viewOnceExpiresAt?: Date | string | null
  mediaDeletedAt?: Date | string | null
  views?: { userId: string; viewedAt: Date | string; openUntil?: Date | string }[]
}

function metaObj(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {}
}

export function viewOnceKindOf(m: { kind?: string | null; imageUrl?: string | null }): ViewOnceKind {
  return m.kind === 'VIDEO' ? 'video' : 'photo'
}

/** The stored media URL behind a view-once message (photo or video). */
export function viewOnceMediaUrlOf(m: { kind?: string | null; imageUrl?: string | null; meta?: unknown }): string | null {
  if (m.kind === 'VIDEO') {
    const v = metaObj(m.meta).videoUrl
    return typeof v === 'string' ? v : null
  }
  return m.imageUrl ?? null
}

export function viewOncePreview(kind: ViewOnceKind): string {
  return kind === 'video' ? VIEW_ONCE_VIDEO_PREVIEW : VIEW_ONCE_PHOTO_PREVIEW
}

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null
  return typeof d === 'string' ? d : d.toISOString()
}

function durationOf(m: MsgLike): number | null {
  const d = metaObj(m.meta).durationSec
  return typeof d === 'number' && Number.isFinite(d) ? d : null
}

/** Seconds a recipient may fetch the file for after opening. */
export function viewWindowSec(kind: ViewOnceKind, durationSec: number | null): number {
  if (kind === 'photo') return PHOTO_WINDOW_SEC
  if (durationSec === null) return VIDEO_MAX_WINDOW_SEC
  return Math.min(VIDEO_MAX_WINDOW_SEC, Math.ceil(durationSec) + VIDEO_SLACK_SEC)
}

/**
 * The view-once state for one viewer. `participantIds` = everyone in the
 * conversation now (the sender is removed when counting recipients).
 */
export function viewOnceInfo(m: MsgLike, viewerId: string, participantIds: string[], now = Date.now()): ViewOnceInfo {
  const kind = viewOnceKindOf(m)
  const views = (m.views ?? []).map((v) => ({ userId: v.userId, viewedAt: toIso(v.viewedAt)! }))
  const expiresAt = toIso(m.viewOnceExpiresAt)
  const gone = !!m.mediaDeletedAt || (!!expiresAt && new Date(expiresAt).getTime() < now)
  const base = { kind, durationSec: kind === 'video' ? durationOf(m) : null, expiresAt }
  if (m.senderId === viewerId) {
    const recipients = participantIds.filter((u) => u !== m.senderId)
    const opened = recipients.length > 0 && recipients.every((u) => views.some((v) => v.userId === u))
    return {
      ...base,
      state: opened ? 'opened' : gone ? (views.length ? 'opened' : 'expired') : 'delivered',
      views,
      recipients: recipients.length,
    }
  }
  const mine = views.find((v) => v.userId === viewerId)
  if (mine) return { ...base, state: 'opened', openedAt: mine.viewedAt }
  return { ...base, state: gone ? 'expired' : 'sealed' }
}

/**
 * Strip everything that could show the media (URL, thumbnail, video URL) and
 * attach `viewOnce` info. Non-view-once messages pass through untouched
 * (only the internal fields are dropped).
 */
export function redactViewOnce<T extends MsgLike>(m: T, viewerId: string, participantIds: string[], now = Date.now()) {
  const { views: _views, mediaDeletedAt: _deleted, viewOnceExpiresAt: _exp, ...rest } = m
  void _views; void _deleted; void _exp
  if (!m.viewOnce) return { ...rest, viewOnce: null as ViewOnceInfo | null }
  const info = viewOnceInfo(m, viewerId, participantIds, now)
  const meta = m.kind === 'VIDEO' ? { durationSec: info.durationSec } : null
  return { ...rest, imageUrl: null, meta, viewOnce: info as ViewOnceInfo | null }
}

/** Prisma select for the fields redactViewOnce needs (add to message queries). */
export const VIEW_ONCE_SELECT = {
  viewOnce: true,
  viewOnceExpiresAt: true,
  mediaDeletedAt: true,
  views: { select: { userId: true, viewedAt: true, openUntil: true } },
} as const

// ── Sending ──────────────────────────────────────────────────────────────────

/** True if any message already uses this media URL (photo or video). */
async function mediaUsedBy(url: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  const hit = await db.message.findFirst({
    where: { ...extra, OR: [{ imageUrl: url }, { kind: 'VIDEO', meta: { path: ['videoUrl'], equals: url } }] },
    select: { id: true },
  })
  return !!hit
}

/**
 * Extra checks for sending `url` as view-once: it must be a fresh upload into
 * the sender's hidden chat album (POST /api/upload purpose=chat|chatvideo)
 * that no message uses yet, so view-once media never also exists as a
 * normal, re-viewable message.
 */
export async function canSendAsViewOnce(url: string, senderId: string): Promise<boolean> {
  const id = mediaIdFromUrl(url)
  if (!id || url !== mediaUrl(id)) return false
  const photo = await db.photo.findUnique({ where: { id }, select: { userId: true, album: { select: { name: true } } } })
  if (!photo || photo.userId !== senderId || photo.album?.name !== CHAT_ALBUM_NAME) return false
  return !(await mediaUsedBy(url))
}

/** Normal sends may not re-use media that was sent view-once. */
export async function isViewOnceMedia(url: string): Promise<boolean> {
  return mediaUsedBy(url, { viewOnce: true })
}

// ── Media gate (/api/media/<id>) ─────────────────────────────────────────────

export type ViewOnceGate = null | 'deny' | { messageId: string; openUntil: Date }

/**
 * null → not view-once media, serve as usual. 'deny' → 404. Otherwise the
 * viewer is inside their open window. Only chat-album media can be view-once,
 * so every other photo costs nothing extra.
 */
export async function viewOnceGate(
  photo: { id: string; album: { name: string } | null },
  viewer: { id: string } | null,
): Promise<ViewOnceGate> {
  if (photo.album?.name !== CHAT_ALBUM_NAME) return null
  const url = mediaUrl(photo.id)
  const msgs = await db.message.findMany({
    where: { viewOnce: true, OR: [{ imageUrl: url }, { kind: 'VIDEO', meta: { path: ['videoUrl'], equals: url } }] },
    select: { id: true, senderId: true, mediaDeletedAt: true, viewOnceExpiresAt: true },
    take: 5,
  })
  if (msgs.length === 0) return null
  if (!viewer) return 'deny'
  const now = new Date()
  if (msgs.some((m) => m.mediaDeletedAt || (m.viewOnceExpiresAt && m.viewOnceExpiresAt < now))) return 'deny'
  // The sender never gets the file back (and admins don't either).
  if (msgs.some((m) => m.senderId === viewer.id)) return 'deny'
  const view = await db.messageView.findFirst({
    where: { messageId: { in: msgs.map((m) => m.id) }, userId: viewer.id, openUntil: { gt: now } },
    select: { messageId: true, openUntil: true },
  })
  return view ? { messageId: view.messageId, openUntil: view.openUntil } : 'deny'
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

/** Delete the stored file(s) of one view-once message (idempotent: claims it first). */
export async function deleteViewOnceMedia(m: { id: string; senderId: string; kind: string | null; imageUrl: string | null; meta: unknown; conversationId: string }): Promise<boolean> {
  const claimed = await db.message.updateMany({ where: { id: m.id, viewOnce: true, mediaDeletedAt: null }, data: { mediaDeletedAt: new Date() } })
  if (claimed.count === 0) return false
  const url = viewOnceMediaUrlOf(m)
  const id = url ? mediaIdFromUrl(url) : null
  if (id) {
    const photo = await db.photo.findUnique({ where: { id }, select: { id: true, userId: true, storageKey: true, mimeType: true, album: { select: { name: true } } } })
    // Only the sender's own chat upload — never anything else that might share the id
    if (photo && photo.userId === m.senderId && photo.album?.name === CHAT_ALBUM_NAME) {
      await db.photo.delete({ where: { id: photo.id } }).catch(() => {})
      await deleteFiles(photoFileKeys(photo))
      await purgeWatermarks(photo.id)
    }
  }
  // Touch the conversation so open chats' streams refresh the bubble
  await db.conversation.update({ where: { id: m.conversationId }, data: { updatedAt: new Date() } }).catch(() => {})
  return true
}

/**
 * Delete media of view-once messages that are done: every current recipient
 * has viewed it and every view window has ended, or it is past its 14 days.
 */
export async function sweepViewOnce(opts: { conversationId?: string; limit?: number } = {}): Promise<{ checked: number; deleted: number }> {
  const now = new Date()
  const rows = await db.message.findMany({
    where: {
      viewOnce: true,
      mediaDeletedAt: null,
      ...(opts.conversationId ? { conversationId: opts.conversationId } : {}),
      OR: [
        { viewOnceExpiresAt: { lt: now } },
        { AND: [{ views: { some: {} } }, { views: { none: { openUntil: { gte: now } } } }] },
      ],
    },
    select: {
      id: true, senderId: true, kind: true, imageUrl: true, meta: true, conversationId: true, viewOnceExpiresAt: true,
      views: { select: { userId: true } },
      conversation: { select: { participants: { select: { userId: true } } } },
    },
    orderBy: { createdAt: 'asc' },
    take: opts.limit ?? 200,
  })
  let deleted = 0
  for (const r of rows) {
    const expired = !!r.viewOnceExpiresAt && r.viewOnceExpiresAt < now
    const recipients = r.conversation.participants.map((p) => p.userId).filter((u) => u !== r.senderId)
    const allViewed = recipients.length > 0 && recipients.every((u) => r.views.some((v) => v.userId === u))
    if (!expired && !allViewed) continue
    try {
      if (await deleteViewOnceMedia(r)) deleted++
    } catch (e) {
      console.error('[view-once] delete failed:', e instanceof Error ? e.message : e)
    }
  }
  return { checked: rows.length, deleted }
}

/** Run a sweep of one conversation after `ms` (e.g. when a view window ends). Best effort. */
export function scheduleViewOnceSweep(conversationId: string, ms: number) {
  const t = setTimeout(() => {
    sweepViewOnce({ conversationId }).catch((e) => console.error('[view-once] sweep failed:', e instanceof Error ? e.message : e))
  }, Math.max(1000, ms))
  t.unref?.()
}
