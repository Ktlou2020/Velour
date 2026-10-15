/**
 * Media URLs.
 *
 * New uploads are stored by Unbound itself and served through `/api/media/<id>`,
 * which checks who may see each file (private albums, private photos).
 * Older uploads may still point at Cloudinary.
 */

export const MEDIA_PATH_PREFIX = '/api/media/'

const MEDIA_ID_RE = /^[a-z0-9]{20,40}$/i

/** Build the URL the app uses for a stored media item. */
export function mediaUrl(id: string): string {
  return `${MEDIA_PATH_PREFIX}${id}`
}

/** Extract the media id from one of our media URLs (relative or absolute), or null. */
export function mediaIdFromUrl(url: string): string | null {
  let path = url
  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url)
      const own = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).host : null
      if (own && u.host !== own) return null
      path = u.pathname
    } catch {
      return null
    }
  }
  if (!path.startsWith(MEDIA_PATH_PREFIX)) return null
  const id = path.slice(MEDIA_PATH_PREFIX.length).split(/[?#/]/)[0]
  return MEDIA_ID_RE.test(id) ? id : null
}

/** Legacy Cloudinary URL on this account's cloud (images or videos). */
export function isLegacyCloudinaryUrl(url: string, kind: 'image' | 'video' = 'image'): boolean {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME
  if (!cloud) return false
  return url.startsWith(`https://res.cloudinary.com/${cloud}/${kind}/upload/`)
}

/** True when `url` is media we host (or legacy Cloudinary media) and safe to store/render. */
export function isOwnMediaUrl(url: unknown, kind: 'image' | 'video' = 'image'): url is string {
  if (typeof url !== 'string' || url.length > 1000) return false
  return mediaIdFromUrl(url) !== null || isLegacyCloudinaryUrl(url, kind)
}

/** Thumbnail variant of one of our media URLs. */
export function mediaThumbUrl(id: string): string {
  return `${mediaUrl(id)}?size=thumb`
}

/**
 * Hidden per-user albums that hold non-gallery media (chat images, the profile
 * video). Photos in these albums are stored as `isPrivate: true` so every
 * existing "public photos" query skips them, and they never show in the
 * gallery or album lists.
 */
export const CHAT_ALBUM_NAME = '__chat'
export const VIDEO_ALBUM_NAME = '__video'
/** Store product photos (uploaded by admins, purpose=product). */
export const STORE_ALBUM_NAME = '__store'
export const SYSTEM_ALBUM_NAMES = [CHAT_ALBUM_NAME, VIDEO_ALBUM_NAME, STORE_ALBUM_NAME]

export function isSystemAlbumName(name: string | null | undefined): boolean {
  return !!name && name.startsWith('__')
}

/**
 * Prisma `where` fragment for a user's real gallery photos (excludes chat
 * images and the profile video). Use it when listing a member's own photos:
 *   db.photo.findMany({ where: { userId, ...GALLERY_PHOTO_WHERE } })
 */
export const GALLERY_PHOTO_WHERE = {
  OR: [{ albumId: null }, { album: { name: { notIn: SYSTEM_ALBUM_NAMES } } }],
}
