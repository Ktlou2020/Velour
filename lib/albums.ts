/** Album helpers shared by the /api/albums routes (server only). */
import { db } from '@/lib/db'
import { SYSTEM_ALBUM_NAMES, isSystemAlbumName } from '@/lib/media'
import { ACCESS, isBlockedBetween } from '@/lib/media-access'

export const MAX_ALBUMS = 50
export const ALBUM_NAME_MAX = 60
export const ALBUM_DESC_MAX = 300

export const USER_SUMMARY_SELECT = {
  id: true,
  username: true,
  profile: { select: { displayName: true, profilePhoto: true } },
} as const

export type UserSummaryRow = {
  id: string
  username: string
  profile: { displayName: string | null; profilePhoto: string | null } | null
}

export function userSummary(u: UserSummaryRow) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.profile?.displayName || u.username,
    avatarUrl: u.profile?.profilePhoto ?? null,
  }
}

/** Validate an album name from a request body. Returns the cleaned name or an error message. */
export function cleanAlbumName(raw: unknown): { name: string } | { error: string } {
  if (typeof raw !== 'string') return { error: 'Album name is required' }
  const name = raw.replace(/\s+/g, ' ').trim()
  if (!name) return { error: 'Album name is required' }
  if (name.length > ALBUM_NAME_MAX) return { error: `Album name must be at most ${ALBUM_NAME_MAX} characters` }
  if (isSystemAlbumName(name)) return { error: 'Album names can’t start with "__"' }
  return { name }
}

export const USER_ALBUM_WHERE = { name: { notIn: SYSTEM_ALBUM_NAMES } }

const photoSelect = { id: true, url: true, thumbnailUrl: true } as const

/** Album rows with what the cards need (cover, photo count). */
export async function albumCards(where: Record<string, unknown>) {
  const albums = await db.album.findMany({
    where: { ...where, ...USER_ALBUM_WHERE },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    include: {
      _count: { select: { photos: true } },
      photos: { select: photoSelect, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], take: 1 },
    },
  })
  const coverIds = albums.map((a) => a.coverPhotoId).filter((x): x is string => !!x)
  const covers = coverIds.length
    ? await db.photo.findMany({ where: { id: { in: coverIds } }, select: { ...photoSelect, albumId: true } })
    : []
  const coverMap = new Map(covers.map((c) => [c.id, c]))
  return albums.map((a) => {
    const chosen = a.coverPhotoId ? coverMap.get(a.coverPhotoId) : undefined
    const cover = chosen && chosen.albumId === a.id ? chosen : a.photos[0]
    return {
      id: a.id,
      ownerId: a.ownerId,
      name: a.name,
      description: a.description,
      isPrivate: a.isPrivate,
      coverPhotoId: a.coverPhotoId,
      coverUrl: cover ? cover.thumbnailUrl ?? cover.url : null,
      photoCount: a._count.photos,
      order: a.order,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }
  })
}

/** Load a user album with its owner; null for system albums / missing. */
export async function findUserAlbum(id: string) {
  const album = await db.album.findUnique({
    where: { id },
    include: { owner: { select: { ...USER_SUMMARY_SELECT, isActive: true } } },
  })
  if (!album || isSystemAlbumName(album.name)) return null
  return album
}

/**
 * What a non-owner viewer gets for an album: null (404: missing, blocked,
 * owner deactivated), 'open' (public or granted), or 'locked' (+ their status).
 */
export async function viewerAlbumState(
  album: { id: string; ownerId: string; isPrivate: boolean; owner: { isActive: boolean } },
  viewerId: string,
  viewerRole?: string | null,
): Promise<{ state: 'owner' | 'open' | 'locked'; status: string | null } | null> {
  if (album.ownerId === viewerId) return { state: 'owner', status: null }
  if (viewerRole === 'ADMIN') return { state: 'open', status: null }
  if (!album.owner.isActive) return null
  if (await isBlockedBetween(viewerId, album.ownerId)) return null
  const access = await db.albumAccess.findUnique({
    where: { albumId_userId: { albumId: album.id, userId: viewerId } },
    select: { status: true },
  })
  const status = access?.status ?? null
  if (!album.isPrivate || status === ACCESS.GRANTED) return { state: 'open', status }
  return { state: 'locked', status }
}
