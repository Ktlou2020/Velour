// Client-safe: where tapping a notification goes. Shared by the bell dropdown
// and /notifications. Prefers data.url when it is a safe internal path,
// otherwise a per-type fallback built from the ids in data.

export interface NotificationLike {
  type: string
  data?: unknown
}

/** An internal, same-origin path ("/x…"), never "//host", "/\\host" or a scheme. */
export function safeInternalPath(v: unknown): string | null {
  if (typeof v !== 'string' || v.length === 0 || v.length > 500) return null
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return null
  if (/[\u0000-\u001f\u007f\\]/.test(v)) return null
  return v
}

function str(d: Record<string, unknown>, k: string): string | null {
  const v = d[k]
  return typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : null
}

export function notificationHref(n: NotificationLike): string {
  const d = (n.data && typeof n.data === 'object' && !Array.isArray(n.data) ? n.data : {}) as Record<string, unknown>
  const url = safeInternalPath(d.url)
  if (url) return url

  const conversationId = str(d, 'conversationId')
  switch (n.type) {
    case 'MESSAGE':
      return conversationId ? `/messages?conv=${conversationId}` : '/messages'
    case 'MATCH':
      return conversationId ? `/messages?conv=${conversationId}` : '/matches'
    case 'LIKE':
    case 'SUPERLIKE':
    case 'WINK':
      return '/matches#liked-you'
    case 'PROFILE_VIEW': {
      const u = str(d, 'viewerUsername')
      return u ? `/members/${u}` : '/views'
    }
    case 'COUPLE_INVITE':
    case 'COUPLE_UPDATE':
      return '/profile#couple'
    case 'PHOTO_LIKE': {
      const p = str(d, 'photoId')
      return p ? `/gallery/explore?photo=${p}` : '/gallery'
    }
    case 'ALBUM_REQUEST': {
      const a = str(d, 'albumId')
      return a ? `/gallery?tab=albums&album=${a}&share=1` : '/gallery?tab=albums'
    }
    case 'ALBUM_INVITE':
    case 'ALBUM_GRANTED': {
      const a = str(d, 'albumId')
      return a ? `/gallery?tab=shared&album=${a}` : '/gallery?tab=shared'
    }
    case 'REVIEW_REQUEST': {
      const r = str(d, 'requestId')
      return r ? `/reviews/write/${r}` : '/reviews'
    }
    case 'REVIEW_RECEIVED':
      return '/reviews#awaiting'
    case 'REVIEW_PUBLISHED':
      return '/reviews#received'
    case 'EVENT_REMINDER':
      return '/events'
    case 'PAYMENT':
      return '/subscription'
    case 'VERIFICATION':
    case 'VERIFIED':
      return '/profile'
    case 'STREAK':
      return '/account'
    case 'REPORT':
      return '/admin/reports'
    default:
      return '/notifications'
  }
}
