/**
 * Who may see which stored media, plus shared helpers for albums (server only).
 *
 * Visibility of a Photo served via /api/media/<id>:
 *   - owner: always
 *   - admin: always
 *   - owner deactivated, or a Block in either direction: never
 *   - chat image / voice note / chat video (hidden "__chat" album) or any photo sent in a chat:
 *       participants of a conversation containing a message with that image/audio/video
 *       (videos: Message.meta.videoUrl)
 *   - profile video (hidden "__video" album): any logged-in member
 *   - store product photo (hidden "__store" album, admin uploads): any logged-in
 *       member, regardless of blocks or the uploading admin's account state
 *   - photo in a user album: public album → any logged-in member;
 *       private album → members with AlbumAccess GRANTED
 *   - photo in no album: public → any logged-in member; private → owner only
 *       (legacy behaviour: loose private photos were never shown to others)
 *   - logged-out visitors: only public main profile photos (landing page)
 */
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'
import { CHAT_ALBUM_NAME, STORE_ALBUM_NAME, VIDEO_ALBUM_NAME, isOwnMediaUrl, isSystemAlbumName, mediaIdFromUrl, mediaUrl } from '@/lib/media'

export const ACCESS = {
  INVITED: 'INVITED',
  REQUESTED: 'REQUESTED',
  GRANTED: 'GRANTED',
  DECLINED: 'DECLINED',
} as const

export type Visibility = 'public' | 'members' | 'private'

export interface Viewer {
  id: string
  role?: string | null
}

export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  if (a === b) return false
  const block = await db.block.findFirst({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
    select: { id: true },
  })
  return !!block
}

/** Ids of users who blocked `userId` or whom `userId` blocked. */
export async function blockedIdsFor(userId: string): Promise<string[]> {
  const rows = await db.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  })
  return rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId))
}

export async function viewerRole(userId: string): Promise<string | null> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } })
  return u?.isActive ? u.role : null
}

/** True when `viewerId` takes part in a conversation that contains this image or voice note. */
async function seenInChat(photoId: string, viewerId: string): Promise<boolean> {
  const url = mediaUrl(photoId)
  const msg = await db.message.findFirst({
    where: {
      OR: [{ imageUrl: url }, { imageUrl: { endsWith: url } }, { audioUrl: url }, { kind: 'VIDEO', meta: { path: ['videoUrl'], equals: url } }],
      conversation: { participants: { some: { userId: viewerId } } },
    },
    select: { id: true },
  })
  return !!msg
}

export type MediaPhoto = {
  id: string
  userId: string
  storageKey: string | null
  mimeType: string | null
  isPrivate: boolean
  isProfile: boolean
  albumId: string | null
  album: { name: string; isPrivate: boolean } | null
  user: { isActive: boolean }
}

/**
 * Decide whether `viewer` (null = logged out) may see `photo`.
 * Returns the cache class to use, or null for "not visible" (respond 404).
 */
export async function photoVisibility(photo: MediaPhoto, viewer: Viewer | null): Promise<Visibility | null> {
  const albumName = photo.album?.name
  const system = isSystemAlbumName(albumName)
  const effectivelyPrivate = photo.album ? photo.album.isPrivate || system : photo.isPrivate

  if (viewer && viewer.id === photo.userId) return effectivelyPrivate ? 'private' : 'members'

  if (!viewer) {
    if (photo.user.isActive && photo.isProfile && !effectivelyPrivate && photo.mimeType?.startsWith('image/')) return 'public'
    return null
  }

  if (viewer.role === 'ADMIN') return 'private'
  // Store product photos belong to the shop, not to the admin who uploaded them.
  if (albumName === STORE_ALBUM_NAME) return 'members'
  if (!photo.user.isActive) return null
  if (await isBlockedBetween(viewer.id, photo.userId)) return null

  if (albumName === VIDEO_ALBUM_NAME) return 'members'
  if (!effectivelyPrivate) return 'members'

  if (albumName !== CHAT_ALBUM_NAME && photo.albumId && photo.album?.isPrivate) {
    const access = await db.albumAccess.findUnique({
      where: { albumId_userId: { albumId: photo.albumId, userId: viewer.id } },
      select: { status: true },
    })
    if (access?.status === ACCESS.GRANTED) return 'private'
  }

  // Any image / voice note sent in a chat is visible to that chat's participants.
  if (await seenInChat(photo.id, viewer.id)) return 'private'
  return null
}

/** True for store product photos (served to members without a per-viewer watermark). */
export function isStoreMedia(photo: { album: { name: string } | null }): boolean {
  return photo.album?.name === STORE_ALBUM_NAME
}

/** Get (or create) one of the user's hidden system albums. */
export async function systemAlbumId(userId: string, name: typeof CHAT_ALBUM_NAME | typeof VIDEO_ALBUM_NAME | typeof STORE_ALBUM_NAME): Promise<string> {
  const existing = await db.album.findFirst({ where: { ownerId: userId, name }, select: { id: true } })
  if (existing) return existing.id
  const created = await db.album.create({
    data: { ownerId: userId, name, isPrivate: true, order: -1 },
    select: { id: true },
  })
  return created.id
}

/** Display name for notifications. */
export async function displayNameOf(userId: string): Promise<{ name: string; username: string }> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { username: true, profile: { select: { displayName: true } } },
  })
  return { name: u?.profile?.displayName || u?.username || 'A member', username: u?.username ?? '' }
}

/** Create an in-app notification and send a push (both best effort). */
export async function notify(userId: string, n: { type: string; title: string; body: string; url: string; data?: Record<string, string> }) {
  try {
    await db.notification.create({
      data: { userId, type: n.type, title: n.title, body: n.body, data: { url: n.url, ...(n.data ?? {}) } },
    })
  } catch (e) {
    console.error('album notification failed:', e instanceof Error ? e.message : e)
  }
  sendPushToUser(userId, { title: n.title, body: n.body, url: n.url, tag: `${n.type}:${n.data?.albumId ?? ''}` }).catch(() => {})
}

/**
 * May `senderId` attach `url` to a chat message? Our own media must be an
 * image the sender uploaded; legacy Cloudinary image URLs are still accepted.
 */
export async function isSendableChatImage(url: unknown, senderId: string): Promise<boolean> {
  if (!isOwnMediaUrl(url, 'image')) return false
  const id = mediaIdFromUrl(url)
  if (!id) return url.startsWith('https://') // legacy Cloudinary (checked by isOwnMediaUrl)
  if (url !== mediaUrl(id)) return false // store only the canonical relative URL
  const photo = await db.photo.findUnique({ where: { id }, select: { userId: true, mimeType: true, storageKey: true } })
  return !!photo && photo.userId === senderId && !!photo.storageKey && !!photo.mimeType?.startsWith('image/')
}

/**
 * May `senderId` attach `url` as a voice note? Must be the canonical URL of an
 * audio file the sender uploaded (POST /api/upload purpose=voice).
 */
export async function isSendableVoiceNote(url: unknown, senderId: string): Promise<boolean> {
  if (typeof url !== 'string' || url.length > 200) return false
  const id = mediaIdFromUrl(url)
  if (!id || url !== mediaUrl(id)) return false
  const photo = await db.photo.findUnique({ where: { id }, select: { userId: true, mimeType: true, storageKey: true } })
  return !!photo && photo.userId === senderId && !!photo.storageKey && !!photo.mimeType?.startsWith('audio/')
}

/**
 * May `senderId` send `url` as a chat video? Must be the canonical URL of a
 * video the sender uploaded with purpose=chatvideo (hidden chat album).
 * Returns the parsed length in seconds (null = unknown), or false.
 */
export async function sendableChatVideo(url: unknown, senderId: string): Promise<{ durationSec: number | null } | false> {
  if (typeof url !== 'string' || url.length > 200) return false
  const id = mediaIdFromUrl(url)
  if (!id || url !== mediaUrl(id)) return false
  const photo = await db.photo.findUnique({
    where: { id },
    select: { userId: true, mimeType: true, storageKey: true, order: true, album: { select: { name: true } } },
  })
  if (!photo || photo.userId !== senderId || !photo.storageKey || !photo.mimeType?.startsWith('video/')) return false
  if (photo.album?.name !== CHAT_ALBUM_NAME) return false
  // `order` holds the length in ms for chat videos (see POST /api/upload, purpose=chatvideo)
  return { durationSec: photo.order >= 0 ? photo.order / 1000 : null }
}
