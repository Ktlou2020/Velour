import { NextRequest, NextResponse } from 'next/server'
import { Readable } from 'stream'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { openStream, statFile, thumbKey } from '@/lib/storage'
import { photoVisibility, type Visibility } from '@/lib/media-access'

export const runtime = 'nodejs'

const ID_RE = /^[a-z0-9]{20,40}$/i

function notFound() {
  return new NextResponse('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}

const CACHE: Record<Visibility, string> = {
  // Visible to anonymous visitors (public main profile photos)
  public: 'public, max-age=3600, stale-while-revalidate=86400',
  // Any logged-in member
  members: 'private, max-age=86400',
  // Private album / chat image: short so a revoke takes effect quickly
  private: 'private, max-age=300',
}

/** Parse a single "bytes=a-b" range. Returns null when absent, 'invalid' when unsatisfiable. */
function parseRange(header: string | null, size: number): { start: number; end: number } | null | 'invalid' {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid'
  let start: number
  let end: number
  if (m[1] === '') {
    const suffix = Number(m[2])
    if (suffix === 0) return 'invalid'
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  if (start > end || start >= size) return 'invalid'
  return { start, end }
}

/**
 * GET /api/media/<id>[?size=thumb]
 * Streams a stored photo/video after checking that the viewer may see it.
 * Anything not visible is a 404 so existence isn't leaked.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!ID_RE.test(id)) return notFound()

    const photo = await db.photo.findUnique({
      where: { id },
      select: {
        id: true, userId: true, storageKey: true, mimeType: true, isPrivate: true, isProfile: true, albumId: true,
        album: { select: { name: true, isPrivate: true } },
        user: { select: { isActive: true } },
      },
    })
    if (!photo?.storageKey || !photo.mimeType) return notFound()

    const session = await auth()
    const viewer = session?.user?.id
      ? { id: session.user.id, role: (session.user as { role?: string }).role ?? null }
      : null
    const visibility = await photoVisibility(photo, viewer)
    if (!visibility) return notFound()

    const isImage = photo.mimeType.startsWith('image/')
    const wantThumb = isImage && req.nextUrl.searchParams.get('size') === 'thumb'
    const key = wantThumb ? thumbKey(photo.storageKey) : photo.storageKey
    const st = await statFile(key)
    if (!st) return notFound()

    const etag = `"${id}${wantThumb ? '-t' : ''}-${st.size}"`
    const headers: Record<string, string> = {
      'Content-Type': photo.mimeType,
      'Cache-Control': CACHE[visibility],
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      'Accept-Ranges': 'bytes',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      ETag: etag,
      Vary: 'Cookie',
    }

    if (req.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers })
    }

    const range = parseRange(req.headers.get('range'), st.size)
    if (range === 'invalid') {
      return new NextResponse(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${st.size}` } })
    }

    if (req.method === 'HEAD') {
      return new NextResponse(null, { status: 200, headers: { ...headers, 'Content-Length': String(st.size) } })
    }

    const stream = openStream(key, range ?? undefined)
    const body = Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>
    if (range) {
      return new NextResponse(body, {
        status: 206,
        headers: {
          ...headers,
          'Content-Range': `bytes ${range.start}-${range.end}/${st.size}`,
          'Content-Length': String(range.end - range.start + 1),
        },
      })
    }
    return new NextResponse(body, { status: 200, headers: { ...headers, 'Content-Length': String(st.size) } })
  } catch (error) {
    console.error('GET /api/media error:', error instanceof Error ? error.message : error)
    return notFound()
  }
}

export { GET as HEAD }
