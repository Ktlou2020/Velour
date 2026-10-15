import { NextRequest, NextResponse } from 'next/server'
import type { Readable } from 'stream'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { openStream, statFile, storedFilePath, thumbKey } from '@/lib/storage'
import { isStoreMedia, photoVisibility, type Visibility } from '@/lib/media-access'
import { getWatermarked, sastDate, watermarkHash, type WatermarkSpec } from '@/lib/watermark'
import { viewOnceGate } from '@/lib/view-once'
import { serveViewOnce } from '@/lib/view-once-serve'

export const runtime = 'nodejs'

const ID_RE = /^[a-z0-9]{20,40}$/i

/**
 * Node stream → web stream. `Readable.toWeb` on Node 18 throws "Controller is
 * already closed" when a download ends or is cancelled, so convert by hand and
 * guard every controller call.
 */
function toWebStream(stream: Readable): ReadableStream<Uint8Array> {
  let done = false
  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on('data', (chunk: Buffer) => {
        if (done) return
        try {
          controller.enqueue(new Uint8Array(chunk))
        } catch {
          done = true
          stream.destroy()
          return
        }
        if ((controller.desiredSize ?? 1) <= 0) stream.pause()
      })
      stream.on('end', () => {
        if (done) return
        done = true
        try { controller.close() } catch { /* already closed */ }
      })
      stream.on('error', (err) => {
        if (done) return
        done = true
        try { controller.error(err) } catch { /* already closed */ }
      })
    },
    pull() {
      if (!done) stream.resume()
    },
    cancel() {
      done = true
      stream.destroy()
    },
  })
}

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
 *
 * Images are served clean only to their owner. Everyone else gets a copy with
 * a forensic watermark burned in (lib/watermark.ts): "@viewer · unbound · date"
 * for members and admins, a generic "UNBOUND" mark for logged-out visitors
 * (public main photos on the landing page). Store product photos (the
 * "__store" album) are served clean to every logged-in member. Watermarked images are always
 * sent whole (no ranges) and never shared between viewers in caches.
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

    // View-once chat media: only inside the recipient's open window, never cached (lib/view-once.ts)
    const viewOnce = await viewOnceGate(photo, viewer)
    if (viewOnce === 'deny') return notFound()
    if (viewOnce && viewer) return serveViewOnce(req, photo, viewer)

    const isImage = photo.mimeType.startsWith('image/')
    const wantThumb = isImage && req.nextUrl.searchParams.get('size') === 'thumb'
    const key = wantThumb ? thumbKey(photo.storageKey) : photo.storageKey
    const st = await statFile(key)
    if (!st) return notFound()

    const isOwner = !!viewer && viewer.id === photo.userId
    // Store product photos are catalogue images, not members' content: no per-viewer mark.
    if (isImage && !isOwner && !isStoreMedia(photo)) {
      const username = viewer ? await viewerUsername(viewer.id, session?.user) : null
      const spec: WatermarkSpec = viewer
        ? { kind: 'viewer', viewerId: viewer.id, username: username ?? viewer.id.slice(-8) }
        : { kind: 'anon' }
      return serveWatermarked(req, {
        id, wantThumb, inputPath: storedFilePath(key), fileTag: `${st.size}-${st.mtime.getTime()}`, spec,
        cacheControl: viewer ? 'private, max-age=300' : CACHE.public,
      })
    }

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
    const body = toWebStream(stream)
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

async function viewerUsername(viewerId: string, user: unknown): Promise<string | null> {
  const fromSession = (user as { username?: string } | undefined)?.username
  if (fromSession) return fromSession
  const u = await db.user.findUnique({ where: { id: viewerId }, select: { username: true } })
  return u?.username ?? null
}

/** Send a per-viewer watermarked copy (rendered once per viewer per day, then from the disk cache). */
async function serveWatermarked(req: NextRequest, o: {
  id: string
  wantThumb: boolean
  inputPath: string
  fileTag: string
  spec: WatermarkSpec
  cacheControl: string
}) {
  const date = sastDate()
  const hash = watermarkHash(o.spec, date, o.fileTag)
  const etag = `"${o.id}${o.wantThumb ? '-t' : ''}-w${hash.slice(0, 24)}"`
  const headers: Record<string, string> = {
    'Content-Type': 'image/webp',
    'Cache-Control': o.cacheControl,
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'inline',
    'Accept-Ranges': 'none',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    ETag: etag,
    Vary: 'Cookie',
  }
  if (req.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers })
  }
  if (req.method === 'HEAD') {
    return new NextResponse(null, { status: 200, headers })
  }
  const { data } = await getWatermarked({
    photoId: o.id,
    variant: o.wantThumb ? 'thumb' : 'full',
    inputPath: o.inputPath,
    fileTag: o.fileTag,
    spec: o.spec,
    date,
    hash,
  })
  return new NextResponse(new Uint8Array(data), { status: 200, headers: { ...headers, 'Content-Length': String(data.length) } })
}

export { GET as HEAD }
