/**
 * Media storage (server only).
 *
 * Two backends behind one small async interface (putObject, getObjectStream,
 * readObject, statObject, deleteObjects — see "Storage drivers" below):
 *
 * - local disk (default): files live under UPLOAD_DIR (in production a
 *   mounted Railway volume, e.g. /data/uploads).
 * - S3-compatible bucket (Railway Buckets, Cloudflare R2, AWS S3, MinIO ...)
 *   when S3_BUCKET is set. Writes go to the bucket only; reads and stats try
 *   the bucket first and fall back to UPLOAD_DIR when the object is not there
 *   (files uploaded before the cut-over, until scripts/migrate-media-to-s3.mjs
 *   has copied them); deletes remove the key from both.
 *
 * Keys are generated here from random bytes — no user input ever reaches a
 * filesystem path or object URL — and look like `2026/10/<32 hex>.webp`. They
 * are identical in both backends, so DB rows never change.
 *
 * Images are re-encoded with sharp: EXIF orientation applied, ALL metadata
 * (GPS, camera, timestamps) stripped, max 2048px long edge, plus a 480px
 * square thumbnail stored next to it as `<key>_t.webp`.
 *
 * Videos are re-encoded with ffmpeg when it is installed (nixpacks.toml adds
 * it in production): H.264/AAC MP4 with faststart, max 1280 px, and the
 * owner's "hush · @username" burned in, hopping between corners every 4 s.
 * Without ffmpeg they are stored as uploaded.
 */
import { AwsClient } from 'aws4fetch'
import { spawn } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import type { Readable } from 'stream'
import sharp from 'sharp'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_VIDEO_BYTES = 30 * 1024 * 1024
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024
const MAX_EDGE = 2048
const THUMB_EDGE = 480
const MAX_INPUT_PIXELS = 60_000_000 // ~ 60 MP; guards against decompression bombs

const KEY_RE = /^\d{4}\/\d{2}\/[a-f0-9]{32}(?:_t)?\.(?:webp|mp4|webm|mov|m4a|ogg|weba)$/

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
  await putObject(key, data)
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

/**
 * Store a video after checking its type and size. With `watermark` and
 * ffmpeg available it is re-encoded with the owner mark burned in (see
 * transcodeVideo); otherwise, or if that fails, the original is stored.
 */
export async function saveVideo(
  input: Buffer,
  maxBytes = MAX_VIDEO_BYTES,
  watermark?: { ownerUsername: string; durationSec: number | null },
): Promise<StoredVideo & { transcoded: boolean }> {
  if (input.length === 0) throw new MediaError('The file is empty')
  if (input.length > maxBytes) throw new MediaError(`Video must be under ${Math.round(maxBytes / 1024 / 1024)}MB`, 413)
  const mimeType = sniffVideo(input)
  if (!mimeType) throw new MediaError('Please upload an MP4, MOV or WebM video', 415)

  if (watermark) {
    const out = await transcodeVideo(input, watermark.ownerUsername, watermark.durationSec)
    if (out) {
      const key = newKey('mp4')
      await writeFile(key, out)
      return { key, mimeType: 'video/mp4', sizeBytes: out.length, transcoded: true }
    }
  }

  const ext = mimeType === 'video/webm' ? 'webm' : mimeType === 'video/quicktime' ? 'mov' : 'mp4'
  const key = newKey(ext)
  await writeFile(key, input)
  return { key, mimeType, sizeBytes: input.length, transcoded: false }
}

// ── ffmpeg ─────────────────────────────────────────────────────────────────

const FFMPEG = process.env.FFMPEG_PATH?.trim() || 'ffmpeg'
const FFPROBE = process.env.FFPROBE_PATH?.trim() || 'ffprobe'
/** Longest video we re-encode (longer ones are stored as uploaded). */
const TRANSCODE_MAX_SEC = 185
const TRANSCODE_TIMEOUT_MS = Number(process.env.TRANSCODE_TIMEOUT_MS) || 150_000
const TRANSCODE_MAX_EDGE = 1280

function run(cmd: string, args: string[], timeoutMs: number): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch {
      resolve({ code: -1, stdout, stderr: 'spawn failed' })
      return
    }
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
    child.stdout?.on('data', (d: Buffer) => { if (stdout.length < 1_000_000) stdout += d.toString() })
    child.stderr?.on('data', (d: Buffer) => { stderr = (stderr + d.toString()).slice(-4000) })
    child.on('error', () => { clearTimeout(timer); resolve({ code: -1, stdout, stderr }) })
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }) })
  })
}

let ffmpegCheck: Promise<boolean> | null = null

/** True when ffmpeg (with libx264 + aac) and ffprobe are on the PATH. Checked once per process. */
export function ffmpegAvailable(): Promise<boolean> {
  if (!ffmpegCheck) {
    ffmpegCheck = (async () => {
      const enc = await run(FFMPEG, ['-hide_banner', '-encoders'], 10_000)
      const probe = await run(FFPROBE, ['-version'], 10_000)
      const ok = enc.code === 0 && /\blibx264\b/.test(enc.stdout) && /\baac\b/.test(enc.stdout) && probe.code === 0
      console.info(`[storage] ffmpeg ${ok ? 'available — videos are re-encoded with an owner watermark' : 'not available — videos are stored as uploaded'}`)
      return ok
    })()
  }
  return ffmpegCheck
}

// One encode at a time per process: keeps the web server responsive.
let encodeQueue: Promise<unknown> = Promise.resolve()

function serialised<T>(job: () => Promise<T>): Promise<T> {
  const next = encodeQueue.then(job, job)
  encodeQueue = next.catch(() => {})
  return next
}

/**
 * Re-encode to H.264/AAC MP4 (faststart, ≤ 1280 px, ≤ 30 fps) with
 * "hush · @owner" burned in, moving corner every 4 s so it can't be blurred
 * out of one spot. Also normalises MOV/WebM for iOS. Returns null (store the
 * original) when ffmpeg is missing, the length is unknown or too long, or
 * anything fails.
 */
export async function transcodeVideo(input: Buffer, ownerUsername: string, durationSec: number | null): Promise<Buffer | null> {
  if (durationSec === null || durationSec > TRANSCODE_MAX_SEC) return null
  if (!(await ffmpegAvailable())) return null
  return serialised(async () => {
    const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'hush-vid-'))
    const started = Date.now()
    try {
      const src = path.join(dir, 'in')
      const mark = path.join(dir, 'mark.png')
      const out = path.join(dir, 'out.mp4')
      await fsp.writeFile(src, input)

      const probe = await run(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', src], 15_000)
      const stream = (() => { try { return JSON.parse(probe.stdout).streams?.[0] } catch { return null } })()
      const w = Number(stream?.width) || 0
      const h = Number(stream?.height) || 0
      if (!w || !h) return null
      const [num, den] = String(stream?.r_frame_rate ?? '').split('/').map(Number)
      const fps = num && den ? num / den : 0
      // Imported here: lib/watermark imports this module (uploadDir)
      const { labelPng, videoLabelText } = await import('@/lib/watermark')
      // Size of the mark relative to the output's short edge
      const scale = Math.min(1, TRANSCODE_MAX_EDGE / Math.max(w, h))
      const short = Math.round(Math.min(w, h) * scale)
      const label = await labelPng(videoLabelText(ownerUsername), Math.max(12, Math.round(short * 0.035)), 0.55)
      await fsp.writeFile(mark, label.png)

      const m = Math.max(8, Math.round(short * 0.03))
      // Corner index 0..3 changes every 4 s: bottom-right, bottom-left, top-left, top-right
      const i = 'mod(floor(t/4),4)'
      const x = `if(eq(${i},0)+eq(${i},3),W-w-${m},${m})`
      const y = `if(lt(${i},2),H-h-${m},${m})`
      const filter =
        `[0:v]scale=w='min(${TRANSCODE_MAX_EDGE},iw)':h='min(${TRANSCODE_MAX_EDGE},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,${fps > 31 ? 'fps=30,' : ''}format=yuv420p[v];` +
        `[v][1:v]overlay=x='${x}':y='${y}':format=auto[o]`
      const res = await run(FFMPEG, [
        '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
        '-i', src, '-i', mark,
        '-filter_complex', filter,
        '-map', '[o]', '-map', '0:a:0?',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
        '-map_metadata', '-1', '-movflags', '+faststart',
        '-t', String(Math.ceil(durationSec) + 1),
        out,
      ], TRANSCODE_TIMEOUT_MS)
      if (res.code !== 0) {
        console.warn('[storage] video transcode failed — storing original:', res.stderr.trim().split('\n').slice(-3).join(' | '))
        return null
      }
      const data = await fsp.readFile(out)
      if (sniffVideo(data) !== 'video/mp4') return null
      console.info(`[storage] video transcoded in ${Date.now() - started} ms (${(input.length / 1e6).toFixed(1)} MB → ${(data.length / 1e6).toFixed(1)} MB, ${durationSec.toFixed(1)} s)`)
      return data
    } catch (e) {
      console.warn('[storage] video transcode error — storing original:', e instanceof Error ? e.message : e)
      return null
    } finally {
      fsp.rm(dir, { recursive: true, force: true }).catch(() => {})
    }
  })
}

export interface StoredAudio {
  key: string
  mimeType: 'audio/webm' | 'audio/mp4' | 'audio/ogg'
  sizeBytes: number
}

/**
 * Identify a voice note container by magic bytes: WebM/Matroska (EBML header,
 * Chrome/Firefox/Android MediaRecorder), MP4/M4A (`ftyp` box, iOS Safari and
 * newer Chrome) or Ogg (`OggS`, Firefox / Opus files).
 */
export function sniffAudio(buf: Buffer): StoredAudio['mimeType'] | null {
  if (buf.length < 12) return null
  if (buf.readUInt32BE(0) === 0x1a45dfa3) return 'audio/webm'
  if (buf.toString('latin1', 0, 4) === 'OggS') return 'audio/ogg'
  if (buf.toString('latin1', 4, 8) === 'ftyp') {
    const brand = buf.toString('latin1', 8, 12)
    // M4A , M4B , isom, iso5, iso6, mp41, mp42, dash ... (not QuickTime movies)
    if (brand !== 'qt  ' && /^[a-zA-Z0-9 ]{4}$/.test(brand)) return 'audio/mp4'
  }
  return null
}

/** Store a voice note as-is after checking its container type and size. */
export async function saveAudio(input: Buffer): Promise<StoredAudio> {
  if (input.length === 0) throw new MediaError('The recording is empty')
  if (input.length > MAX_AUDIO_BYTES) throw new MediaError('Voice notes must be under 5MB', 413)
  const mimeType = sniffAudio(input)
  if (!mimeType) throw new MediaError('That file is not a supported voice note', 415)
  const ext = mimeType === 'audio/webm' ? 'weba' : mimeType === 'audio/ogg' ? 'ogg' : 'm4a'
  const key = newKey(ext)
  await writeFile(key, input)
  return { key, mimeType, sizeBytes: input.length }
}

// ── Video duration from the file bytes (never trust the client) ────────────

/** Duration (seconds) of an MP4/MOV from moov → mvhd, or from mvex → mehd for fragmented files. */
function mp4Duration(buf: Buffer): number | null {
  // Iterate the boxes in [start, end); returns [type, payloadStart, boxEnd]
  function* boxes(start: number, end: number): Generator<[string, number, number]> {
    let off = start
    while (off + 8 <= end) {
      let size = buf.readUInt32BE(off)
      const type = buf.toString('latin1', off + 4, off + 8)
      let header = 8
      if (size === 1) {
        if (off + 16 > end) return
        const big = Number(buf.readBigUInt64BE(off + 8))
        if (!Number.isSafeInteger(big)) return
        size = big
        header = 16
      } else if (size === 0) {
        size = end - off
      }
      if (size < header) return
      const boxEnd = Math.min(off + size, end)
      yield [type, off + header, boxEnd]
      off += size
    }
  }
  for (const [type, p, e] of boxes(0, buf.length)) {
    if (type !== 'moov') continue
    let fragmentDuration: number | null = null
    let timescale = 0
    let duration: number | null = null
    for (const [ct, cp, ce] of boxes(p, e)) {
      if (ct === 'mvhd' && cp + 4 <= ce) {
        const version = buf[cp]
        if (version === 1 && cp + 32 <= ce) {
          timescale = buf.readUInt32BE(cp + 20)
          duration = Number(buf.readBigUInt64BE(cp + 24))
        } else if (version === 0 && cp + 20 <= ce) {
          timescale = buf.readUInt32BE(cp + 12)
          duration = buf.readUInt32BE(cp + 16)
        }
      } else if (ct === 'mvex') {
        for (const [mt, mp, me] of boxes(cp, ce)) {
          if (mt !== 'mehd' || mp + 8 > me) continue
          const v = buf[mp]
          fragmentDuration = v === 1 && mp + 12 <= me ? Number(buf.readBigUInt64BE(mp + 4)) : buf.readUInt32BE(mp + 4)
        }
      }
    }
    if (!timescale) return null
    // 0xFFFFFFFF / 0 mean "unknown" (e.g. fragmented recordings)
    const d = duration && duration !== 0xffffffff ? duration : fragmentDuration
    return d ? d / timescale : null
  }
  return null
}

/** Read an EBML variable-size integer at `off`. */
function vint(buf: Buffer, off: number, keepMarker: boolean): { value: number; len: number; unknown: boolean } | null {
  if (off >= buf.length) return null
  const first = buf[off]
  let len = 1
  let mask = 0x80
  while (len <= 8 && !(first & mask)) { len++; mask >>= 1 }
  if (len > 8 || off + len > buf.length) return null
  let value = keepMarker ? first : first & (mask - 1)
  let allOnes = (first & (mask - 1)) === mask - 1
  for (let i = 1; i < len; i++) {
    value = value * 256 + buf[off + i]
    if (buf[off + i] !== 0xff) allOnes = false
  }
  return { value, len, unknown: !keepMarker && allOnes }
}

const EBML = { Segment: 0x18538067, Info: 0x1549a966, TimecodeScale: 0x2ad7b1, Duration: 0x4489, Cluster: 0x1f43b675, Timecode: 0xe7, SimpleBlock: 0xa3, BlockGroup: 0xa0, Block: 0xa1 }

/**
 * Duration (seconds) of a WebM: Segment → Info → Duration × TimecodeScale.
 * MediaRecorder files often omit Duration, so fall back to the last
 * cluster/block timestamp (clusters may have unknown sizes too).
 */
function webmDuration(buf: Buffer): number | null {
  let off = 0
  // EBML header
  const h = vint(buf, off, true); if (!h || h.value !== 0x1a45dfa3) return null
  const hs = vint(buf, off + h.len, false); if (!hs) return null
  off += h.len + hs.len + hs.value
  const seg = vint(buf, off, true); if (!seg || seg.value !== EBML.Segment) return null
  const segSize = vint(buf, off + seg.len, false); if (!segSize) return null
  off += seg.len + segSize.len
  const segEnd = segSize.unknown ? buf.length : Math.min(buf.length, off + segSize.value)

  let scale = 1_000_000
  let infoDuration: number | null = null
  let lastTs = -1
  while (off < segEnd) {
    const id = vint(buf, off, true); if (!id) break
    const sz = vint(buf, off + id.len, false); if (!sz) break
    const p = off + id.len + sz.len
    if (id.value === EBML.Info) {
      const end = Math.min(segEnd, p + sz.value)
      let q = p
      while (q < end) {
        const cid = vint(buf, q, true); if (!cid) break
        const csz = vint(buf, q + cid.len, false); if (!csz) break
        const cp = q + cid.len + csz.len
        if (cid.value === EBML.TimecodeScale && csz.value <= 8) scale = buf.readUIntBE(cp, Math.min(6, csz.value)) || scale
        if (cid.value === EBML.Duration && cp + csz.value <= buf.length) {
          infoDuration = csz.value === 4 ? buf.readFloatBE(cp) : csz.value === 8 ? buf.readDoubleBE(cp) : null
        }
        q = cp + csz.value
      }
      off = end
      continue
    }
    if (id.value === EBML.Cluster) {
      // Walk the cluster's children (size may be unknown → until the next Cluster)
      const end = sz.unknown ? segEnd : Math.min(segEnd, p + sz.value)
      let q = p
      let clusterTs = 0
      while (q < end) {
        const cid = vint(buf, q, true); if (!cid) break
        if (sz.unknown && cid.value === EBML.Cluster) break
        const csz = vint(buf, q + cid.len, false); if (!csz || csz.unknown) break
        const cp = q + cid.len + csz.len
        if (cid.value === EBML.Timecode && csz.value <= 8) clusterTs = buf.readUIntBE(cp, Math.min(6, csz.value))
        if (cid.value === EBML.SimpleBlock && cp + 4 <= buf.length) {
          const track = vint(buf, cp, false)
          if (track) lastTs = Math.max(lastTs, clusterTs + buf.readInt16BE(cp + track.len))
        }
        q = cp + csz.value
      }
      if (lastTs < 0) lastTs = clusterTs
      off = q
      continue
    }
    if (sz.unknown) break
    off = p + sz.value
  }
  if (infoDuration && Number.isFinite(infoDuration) && infoDuration > 0) return (infoDuration * scale) / 1e9
  return lastTs >= 0 ? (lastTs * scale) / 1e9 : null
}

/** Duration in seconds parsed from MP4/MOV/WebM bytes, or null if it can't be determined. */
export function videoDurationSec(buf: Buffer, mimeType: string): number | null {
  try {
    const d = mimeType === 'video/webm' ? webmDuration(buf) : mp4Duration(buf)
    return d !== null && Number.isFinite(d) && d >= 0 && d < 24 * 3600 ? d : null
  } catch {
    return null
  }
}

// ── Storage drivers ────────────────────────────────────────────────────────

/** Inclusive byte range. */
export interface ByteRange {
  start: number
  end: number
}

export interface ObjectInfo {
  size: number
  mtime: Date
}

export interface ObjectStream {
  /** The bytes (the whole object, or just `range`). */
  body: ReadableStream<Uint8Array>
  /** Size of the whole object. */
  size: number
  /** Bytes in `body`. */
  contentLength: number
  /** `bytes a-b/size` when a range was requested. */
  contentRange?: string
  contentType: string
}

interface StorageDriver {
  readonly name: string
  putObject(key: string, data: Buffer, contentType: string): Promise<void>
  /** null when the object does not exist. */
  getObjectStream(key: string, range?: ByteRange): Promise<ObjectStream | null>
  /** Whole object in memory (images, ≤ 10 MB). null when missing. */
  readObject(key: string): Promise<Buffer | null>
  statObject(key: string): Promise<ObjectInfo | null>
  /** Missing keys are ignored. */
  deleteObjects(keys: string[]): Promise<void>
}

const CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  m4a: 'audio/mp4', ogg: 'audio/ogg', weba: 'audio/webm',
}

function contentTypeFor(key: string): string {
  return CONTENT_TYPES[key.slice(key.lastIndexOf('.') + 1)] ?? 'application/octet-stream'
}

function validKey(key: string): string {
  if (!KEY_RE.test(key)) throw new Error('Invalid storage key')
  return key
}

/**
 * Node stream → web stream. `Readable.toWeb` on Node 18 throws "Controller is
 * already closed" when a download ends or is cancelled, so convert by hand and
 * guard every controller call.
 */
export function nodeToWebStream(stream: Readable): ReadableStream<Uint8Array> {
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

// ── Local disk (UPLOAD_DIR) ──

const localDriver: StorageDriver = {
  name: 'local',

  async putObject(key, data) {
    const full = resolveKey(key)
    await fsp.mkdir(path.dirname(full), { recursive: true })
    const tmp = `${full}.${crypto.randomBytes(4).toString('hex')}.tmp`
    await fsp.writeFile(tmp, data, { mode: 0o640 })
    await fsp.rename(tmp, full)
  },

  async statObject(key) {
    try {
      const st = await fsp.stat(resolveKey(key))
      return st.isFile() ? { size: st.size, mtime: st.mtime } : null
    } catch {
      return null
    }
  },

  async getObjectStream(key, range) {
    const st = await localDriver.statObject(key)
    if (!st) return null
    if (range && (range.start > range.end || range.end >= st.size)) throw new Error('Range not satisfiable')
    const stream = fs.createReadStream(resolveKey(key), range ? { start: range.start, end: range.end } : undefined)
    return {
      body: nodeToWebStream(stream),
      size: st.size,
      contentLength: range ? range.end - range.start + 1 : st.size,
      contentRange: range ? `bytes ${range.start}-${range.end}/${st.size}` : undefined,
      contentType: contentTypeFor(key),
    }
  },

  async readObject(key) {
    try {
      return await fsp.readFile(resolveKey(key))
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT' || (e as NodeJS.ErrnoException).code === 'EISDIR') return null
      throw e
    }
  },

  async deleteObjects(keys) {
    await Promise.all(keys.map(async (k) => {
      try {
        await fsp.unlink(resolveKey(k))
      } catch {
        /* already gone */
      }
    }))
  },
}

// ── S3-compatible bucket (aws4fetch, SigV4) ──

interface S3Config {
  bucket: string
  endpoint: URL
  region: string
  pathStyle: boolean
  client: AwsClient
}

const S3_TIMEOUT_MS = Number(process.env.S3_TIMEOUT_MS) || 20_000

class S3Error extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

let s3Cached: { sig: string; cfg: S3Config | null } | null = null

/** Bucket settings from the environment, or null when S3_BUCKET is unset (local disk only). */
function s3Config(): S3Config | null {
  const env = process.env
  const bucket = env.S3_BUCKET?.trim() ?? ''
  const sig = [bucket, env.S3_ENDPOINT, env.S3_ACCESS_KEY_ID, env.S3_SECRET_ACCESS_KEY, env.S3_REGION, env.S3_FORCE_PATH_STYLE].join('|')
  if (s3Cached?.sig === sig) return s3Cached.cfg
  let cfg: S3Config | null = null
  if (bucket) {
    const endpoint = env.S3_ENDPOINT?.trim()
    const accessKeyId = env.S3_ACCESS_KEY_ID?.trim()
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim()
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error('[storage] S3_BUCKET is set but S3_ENDPOINT, S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY is missing')
    }
    const region = env.S3_REGION?.trim() || 'auto'
    const url = new URL(endpoint.replace(/\/+$/, ''))
    const pathStyle = /^(1|true|yes)$/i.test(env.S3_FORCE_PATH_STYLE?.trim() ?? '')
    cfg = {
      bucket,
      endpoint: url,
      region,
      pathStyle,
      // aws4fetch retries 5xx / 429 with backoff; keep it short on the request path
      client: new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region, retries: 2, initRetryMs: 100 }),
    }
    console.info(`[storage] S3 bucket "${bucket}" at ${url.host} (${pathStyle ? 'path-style' : 'virtual-hosted'}) — new media goes to the bucket, reads fall back to ${uploadDir()}`)
  }
  s3Cached = { sig, cfg }
  return cfg
}

function objectUrl(cfg: S3Config, key: string): string {
  const base = cfg.endpoint.pathname.replace(/\/+$/, '')
  // Keys are KEY_RE-validated: [0-9a-f/._] only, nothing to escape.
  return cfg.pathStyle
    ? `${cfg.endpoint.protocol}//${cfg.endpoint.host}${base}/${encodeURIComponent(cfg.bucket)}/${key}`
    : `${cfg.endpoint.protocol}//${cfg.bucket}.${cfg.endpoint.host}${base}/${key}`
}

/** Signed request; the timeout covers connecting and the response headers, not a long body download. */
async function s3Fetch(cfg: S3Config, method: string, key: string, init: { headers?: Record<string, string>; body?: Buffer } = {}): Promise<Response> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(new Error(`S3 ${method} timed out`)), S3_TIMEOUT_MS)
  try {
    if (!init.body) return await cfg.client.fetch(objectUrl(cfg, key), { method, headers: init.headers, signal: ac.signal })
    // aws4fetch wraps a body in a streaming Request, which Node sends chunked with no
    // Content-Length — S3 rejects that (411 MissingContentLength). Sign, then send the
    // raw bytes so fetch sets Content-Length itself.
    const bytes = new Uint8Array(init.body.buffer, init.body.byteOffset, init.body.length) as unknown as BodyInit
    for (let attempt = 0; ; attempt++) {
      const signed = await cfg.client.sign(objectUrl(cfg, key), { method, headers: init.headers, body: bytes })
      try {
        const res = await fetch(signed.url, { method, headers: signed.headers, body: bytes, signal: ac.signal })
        if ((res.status >= 500 || res.status === 429) && attempt < 2) {
          await res.body?.cancel().catch(() => {})
          await new Promise((r) => setTimeout(r, 100 * 2 ** attempt))
          continue
        }
        return res
      } catch (e) {
        if (ac.signal.aborted || attempt >= 2) throw e
        await new Promise((r) => setTimeout(r, 100 * 2 ** attempt))
      }
    }
  } finally {
    clearTimeout(timer)
  }
}

async function s3Fail(res: Response, what: string): Promise<never> {
  const text = await res.text().catch(() => '')
  const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1]
  throw new S3Error(`S3 ${what} failed: ${res.status}${code ? ` ${code}` : ''}`, res.status)
}

function s3Driver(cfg: S3Config): StorageDriver {
  return {
    name: 's3',

    async putObject(key, data, contentType) {
      const res = await s3Fetch(cfg, 'PUT', key, {
        headers: { 'Content-Type': contentType },
        body: data,
      })
      if (!res.ok) await s3Fail(res, `PUT ${key}`)
      await res.body?.cancel().catch(() => {})
    },

    async statObject(key) {
      const res = await s3Fetch(cfg, 'HEAD', key)
      if (res.status === 404) return null
      if (!res.ok) throw new S3Error(`S3 HEAD ${key} failed: ${res.status}`, res.status)
      const size = Number(res.headers.get('content-length'))
      const lm = res.headers.get('last-modified')
      return { size: Number.isFinite(size) ? size : 0, mtime: lm ? new Date(lm) : new Date(0) }
    },

    async getObjectStream(key, range) {
      const res = await s3Fetch(cfg, 'GET', key, range ? { headers: { Range: `bytes=${range.start}-${range.end}` } } : {})
      if (res.status === 404) {
        await res.body?.cancel().catch(() => {})
        return null
      }
      if (!res.ok || !res.body) await s3Fail(res, `GET ${key}`)
      const contentLength = Number(res.headers.get('content-length'))
      if (range) {
        const cr = res.headers.get('content-range') ?? ''
        const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(cr)
        if (res.status !== 206 || !m || Number(m[1]) !== range.start || Number(m[2]) !== range.end) {
          await res.body!.cancel().catch(() => {})
          throw new S3Error(`S3 GET ${key}: range not honoured (${res.status} ${cr})`, 502)
        }
        return { body: res.body!, size: Number(m[3]), contentLength: range.end - range.start + 1, contentRange: cr, contentType: contentTypeFor(key) }
      }
      return { body: res.body!, size: contentLength, contentLength, contentType: contentTypeFor(key) }
    },

    async readObject(key) {
      const res = await s3Fetch(cfg, 'GET', key)
      if (res.status === 404) {
        await res.body?.cancel().catch(() => {})
        return null
      }
      if (!res.ok) await s3Fail(res, `GET ${key}`)
      return Buffer.from(await res.arrayBuffer())
    },

    async deleteObjects(keys) {
      // Plain DeleteObject per key (DeleteObjects needs Content-MD5 and isn't on every provider)
      const queue = [...keys]
      const worker = async () => {
        for (let k = queue.shift(); k; k = queue.shift()) {
          const res = await s3Fetch(cfg, 'DELETE', k)
          await res.body?.cancel().catch(() => {})
          if (!res.ok && res.status !== 404) throw new S3Error(`S3 DELETE ${k} failed: ${res.status}`, res.status)
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker))
    },
  }
}

let lastS3Warn = 0
function warnS3(op: string, key: string, e: unknown) {
  if (Date.now() - lastS3Warn < 60_000) return
  lastS3Warn = Date.now()
  console.warn(`[storage] S3 ${op} ${key} failed, falling back to local disk:`, e instanceof Error ? e.message : e)
}

/**
 * Bucket first, then UPLOAD_DIR. "Not in the bucket" (404) and bucket errors
 * (network, 5xx, 403) both fall back to the local copy, so media that hasn't
 * been migrated keeps working and a bucket outage only affects new uploads.
 */
async function readThrough<T>(op: string, key: string, s3: () => Promise<T | null>, local: () => Promise<T | null>): Promise<T | null> {
  try {
    const hit = await s3()
    if (hit !== null) return hit
  } catch (e) {
    warnS3(op, key, e)
  }
  return local()
}

function fallbackDriver(s3: StorageDriver): StorageDriver {
  return {
    name: 's3+local',
    putObject: (key, data, ct) => s3.putObject(key, data, ct),
    statObject: (key) => readThrough('HEAD', key, () => s3.statObject(key), () => localDriver.statObject(key)),
    readObject: (key) => readThrough('GET', key, () => s3.readObject(key), () => localDriver.readObject(key)),
    getObjectStream: (key, range) => readThrough('GET', key, () => s3.getObjectStream(key, range), () => localDriver.getObjectStream(key, range)),
    async deleteObjects(keys) {
      const [a, b] = await Promise.allSettled([s3.deleteObjects(keys), localDriver.deleteObjects(keys)])
      if (a.status === 'rejected') throw a.reason
      if (b.status === 'rejected') throw b.reason
    },
  }
}

let driverCache: { cfg: S3Config | null; driver: StorageDriver } | null = null

/** The active backend: S3 (+ local read fallback) when S3_BUCKET is set, else local disk. */
function driver(): StorageDriver {
  const cfg = s3Config()
  if (driverCache?.cfg !== cfg) driverCache = { cfg, driver: cfg ? fallbackDriver(s3Driver(cfg)) : localDriver }
  return driverCache.driver
}

/** 'local' or 's3+local' — for logs / health output. */
export function storageBackend(): string {
  return driver().name
}

/** Store bytes under `key` (bucket when S3 is configured, else UPLOAD_DIR). */
export async function putObject(key: string, data: Buffer, contentType = contentTypeFor(key)): Promise<void> {
  await driver().putObject(validKey(key), data, contentType)
}

/**
 * Stream a stored object, optionally an inclusive byte range that the caller
 * has already checked against statObject().size. null when missing.
 */
export async function getObjectStream(key: string, range?: ByteRange): Promise<ObjectStream | null> {
  return driver().getObjectStream(validKey(key), range)
}

/** Whole stored object as a Buffer (images for sharp), or null when missing. */
export async function readObject(key: string): Promise<Buffer | null> {
  return driver().readObject(validKey(key))
}

/** Size + modified time of a stored object, or null if it is missing. */
export async function statObject(key: string): Promise<ObjectInfo | null> {
  if (!KEY_RE.test(key)) return null
  return driver().statObject(key)
}

/** @deprecated alias of statObject */
export const statFile = statObject

/**
 * Best-effort delete of stored objects (from the bucket AND UPLOAD_DIR when S3
 * is configured; invalid keys and missing objects are ignored). Never throws.
 */
export async function deleteObjects(keys: Array<string | null | undefined>): Promise<void> {
  const valid = [...new Set(keys.filter((k): k is string => !!k && KEY_RE.test(k)))]
  if (!valid.length) return
  try {
    await driver().deleteObjects(valid)
  } catch (e) {
    console.warn('[storage] delete failed:', e instanceof Error ? e.message : e)
  }
}

/** Alias of deleteObjects (existing call sites). */
export const deleteFiles = deleteObjects

/** All files belonging to a Photo row (main + thumbnail for images). */
export function photoFileKeys(photo: { storageKey: string | null; mimeType: string | null }): string[] {
  if (!photo.storageKey) return []
  return photo.mimeType?.startsWith('image/') ? [photo.storageKey, thumbKey(photo.storageKey)] : [photo.storageKey]
}
