/**
 * Local media storage (server only).
 *
 * Files live under UPLOAD_DIR (in production: a mounted Railway volume, e.g.
 * /data/uploads). Keys are generated here from random bytes — no user input
 * ever reaches a filesystem path — and look like `2026/10/<32 hex>.webp`.
 *
 * Images are re-encoded with sharp: EXIF orientation applied, ALL metadata
 * (GPS, camera, timestamps) stripped, max 2048px long edge, plus a 480px
 * square thumbnail stored next to it as `<key>_t.webp`.
 */
import crypto from 'crypto'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import sharp from 'sharp'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024
const MAX_EDGE = 2048
const THUMB_EDGE = 480
const MAX_INPUT_PIXELS = 60_000_000 // ~ 60 MP; guards against decompression bombs

const KEY_RE = /^\d{4}\/\d{2}\/[a-f0-9]{32}(?:_t)?\.(?:webp|mp4|webm|mov)$/

let warned = false

/** Root directory for stored media. */
export function uploadDir(): string {
  const dir = process.env.UPLOAD_DIR?.trim()
  if (dir) return path.resolve(dir)
  if (process.env.NODE_ENV === 'production' && !warned) {
    warned = true
    console.warn('[storage] UPLOAD_DIR is not set — uploads go to the container filesystem and are lost on redeploy. Mount a volume and set UPLOAD_DIR.')
  }
  return path.resolve(process.cwd(), '.uploads')
}

function resolveKey(key: string): string {
  if (!KEY_RE.test(key)) throw new Error('Invalid storage key')
  const root = uploadDir()
  const full = path.resolve(root, key)
  if (!full.startsWith(root + path.sep)) throw new Error('Invalid storage key')
  return full
}

function newKey(ext: string): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}/${m}/${crypto.randomBytes(16).toString('hex')}.${ext}`
}

/** Key of the thumbnail stored alongside an image key. */
export function thumbKey(key: string): string {
  return key.replace(/\.webp$/, '_t.webp')
}

async function writeFile(key: string, data: Buffer): Promise<void> {
  const full = resolveKey(key)
  await fsp.mkdir(path.dirname(full), { recursive: true })
  const tmp = `${full}.${crypto.randomBytes(4).toString('hex')}.tmp`
  await fsp.writeFile(tmp, data, { mode: 0o640 })
  await fsp.rename(tmp, full)
}

export class MediaError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export interface StoredImage {
  key: string
  thumbKey: string
  mimeType: 'image/webp'
  sizeBytes: number
  width: number
  height: number
}

const IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'heif', 'tiff'])

/**
 * Validate (by decoding the actual bytes, never trusting the client's mime
 * type), clean and store an image. Throws MediaError for bad input.
 */
export async function saveImage(input: Buffer): Promise<StoredImage> {
  if (input.length === 0) throw new MediaError('The file is empty')
  if (input.length > MAX_IMAGE_BYTES) throw new MediaError('Images must be under 10MB', 413)

  let meta: sharp.Metadata
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata()
  } catch {
    throw new MediaError('That file is not a supported image. Please choose a JPG, PNG or WebP photo.', 415)
  }
  if (!meta.format || !IMAGE_FORMATS.has(meta.format)) {
    throw new MediaError('That file is not a supported image. Please choose a JPG, PNG or WebP photo.', 415)
  }

  let main: { data: Buffer; info: sharp.OutputInfo }
  let thumb: Buffer
  try {
    const base = () => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).rotate()
    // sharp drops all metadata (EXIF/GPS/XMP/ICC) unless .withMetadata() is called.
    main = await base()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true })
    thumb = await base()
      .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: 'cover', position: sharp.strategy.attention })
      .webp({ quality: 76 })
      .toBuffer()
  } catch {
    if (meta.format === 'heif') {
      throw new MediaError('HEIC photos from iPhone can’t be processed here. Please choose a JPG or PNG (iPhone: Settings → Camera → Formats → Most Compatible).', 415)
    }
    throw new MediaError('That image could not be read. Please try a different JPG or PNG.', 415)
  }

  const key = newKey('webp')
  const tKey = thumbKey(key)
  await writeFile(key, main.data)
  try {
    await writeFile(tKey, thumb)
  } catch (e) {
    await deleteFiles([key])
    throw e
  }
  return {
    key,
    thumbKey: tKey,
    mimeType: 'image/webp',
    sizeBytes: main.data.length,
    width: main.info.width,
    height: main.info.height,
  }
}

export interface StoredVideo {
  key: string
  mimeType: 'video/mp4' | 'video/webm' | 'video/quicktime'
  sizeBytes: number
}

/** Identify mp4 / mov / webm by magic bytes. */
export function sniffVideo(buf: Buffer): StoredVideo['mimeType'] | null {
  if (buf.length < 12) return null
  if (buf.readUInt32BE(0) === 0x1a45dfa3) return 'video/webm'
  if (buf.toString('latin1', 4, 8) === 'ftyp') {
    const brand = buf.toString('latin1', 8, 12)
    if (brand === 'qt  ') return 'video/quicktime'
    // isom, iso2, mp41, mp42, avc1, M4V , 3gp*, dash ...
    if (/^[a-zA-Z0-9 ]{4}$/.test(brand)) return 'video/mp4'
  }
  return null
}

/** Store a video as-is after checking its type and size. */
export async function saveVideo(input: Buffer): Promise<StoredVideo> {
  if (input.length === 0) throw new MediaError('The file is empty')
  if (input.length > MAX_VIDEO_BYTES) throw new MediaError('Video must be under 30MB', 413)
  const mimeType = sniffVideo(input)
  if (!mimeType) throw new MediaError('Please upload an MP4, MOV or WebM video', 415)
  const ext = mimeType === 'video/webm' ? 'webm' : mimeType === 'video/quicktime' ? 'mov' : 'mp4'
  const key = newKey(ext)
  await writeFile(key, input)
  return { key, mimeType, sizeBytes: input.length }
}

/** Size of a stored file, or null if it is missing. */
export async function statFile(key: string): Promise<{ size: number; mtime: Date } | null> {
  try {
    const st = await fsp.stat(resolveKey(key))
    return st.isFile() ? { size: st.size, mtime: st.mtime } : null
  } catch {
    return null
  }
}

/** Read stream over a stored file (optionally a byte range, inclusive). */
export function openStream(key: string, range?: { start: number; end: number }): fs.ReadStream {
  return fs.createReadStream(resolveKey(key), range ? { start: range.start, end: range.end } : undefined)
}

/** Best-effort delete of stored files (missing files are ignored). */
export async function deleteFiles(keys: Array<string | null | undefined>): Promise<void> {
  await Promise.all(
    keys.filter((k): k is string => !!k && KEY_RE.test(k)).map(async (k) => {
      try {
        await fsp.unlink(resolveKey(k))
      } catch {
        /* already gone */
      }
    }),
  )
}

/** All files belonging to a Photo row (main + thumbnail for images). */
export function photoFileKeys(photo: { storageKey: string | null; mimeType: string | null }): string[] {
  if (!photo.storageKey) return []
  return photo.mimeType?.startsWith('image/') ? [photo.storageKey, thumbKey(photo.storageKey)] : [photo.storageKey]
}
