/**
 * Serving a view-once file from /api/media/<id> to a recipient inside their
 * open window (see lib/view-once.ts viewOnceGate). Server only.
 *
 * - never cached anywhere: `no-store, private`, no ETag / 304
 * - no thumbnails (`?size=thumb` → 404), so no preview ever exists
 * - images: the per-viewer forensic watermark is burned in on every request
 *   (rendered in memory, never written to the watermark disk cache)
 * - videos: byte ranges allowed (the owner mark is burned in at upload)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getObjectStream, statObject } from '@/lib/storage'
import { renderWatermarked, sastDate } from '@/lib/watermark'

const BASE_HEADERS = {
  'Cache-Control': 'no-store, private, max-age=0',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'Content-Disposition': 'inline',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'none'; sandbox",
  'X-Robots-Tag': 'noindex, noarchive',
  Vary: 'Cookie',
}

function notFound() {
  return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
}

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

export async function serveViewOnce(
  req: NextRequest,
  photo: { id: string; storageKey: string | null; mimeType: string | null },
  viewer: { id: string },
): Promise<NextResponse> {
  if (!photo.storageKey || !photo.mimeType) return notFound()
  if (req.nextUrl.searchParams.get('size') === 'thumb') return notFound()
  const st = await statObject(photo.storageKey)
  if (!st) return notFound()

  if (photo.mimeType.startsWith('image/')) {
    const u = await db.user.findUnique({ where: { id: viewer.id }, select: { username: true } })
    const headers = { ...BASE_HEADERS, 'Content-Type': 'image/webp', 'Accept-Ranges': 'none' }
    if (req.method === 'HEAD') return new NextResponse(null, { status: 200, headers })
    const data = await renderWatermarked(
      photo.storageKey,
      { kind: 'viewer', viewerId: viewer.id, username: u?.username ?? viewer.id.slice(-8) },
      sastDate(),
      `${st.size}-${st.mtime.getTime()}`,
    )
    return new NextResponse(new Uint8Array(data), { status: 200, headers: { ...headers, 'Content-Length': String(data.length) } })
  }

  const headers: Record<string, string> = { ...BASE_HEADERS, 'Content-Type': photo.mimeType, 'Accept-Ranges': 'bytes' }
  const range = parseRange(req.headers.get('range'), st.size)
  if (range === 'invalid') {
    return new NextResponse(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${st.size}` } })
  }
  if (req.method === 'HEAD') {
    return new NextResponse(null, { status: 200, headers: { ...headers, 'Content-Length': String(st.size) } })
  }
  const obj = await getObjectStream(photo.storageKey, range ?? undefined)
  if (!obj) return notFound()
  const body = obj.body
  if (range) {
    return new NextResponse(body, {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${st.size}`, 'Content-Length': String(range.end - range.start + 1) },
    })
  }
  return new NextResponse(body, { status: 200, headers: { ...headers, 'Content-Length': String(st.size) } })
}
