/**
 * Forensic, per-viewer image watermarks (server only).
 *
 * Every image a member opens that isn't their own is served with the
 * viewer's username and the date burned into the pixels: a faint diagonal
 * pattern tiled over the whole picture (so it can't be cropped out) plus a
 * small solid "HUSH · @viewer" mark in the corner. A saved or screenshotted
 * copy therefore names whoever took it.
 *
 * Text is drawn from embedded glyph outlines (lib/watermark-glyphs.ts), never
 * from system fonts. Rendered copies are cached on disk under
 *   ${UPLOAD_DIR}/.wm-cache/<photoId>/<full|thumb>/<sha256>.webp
 * and swept after WM_CACHE_MAX_AGE_MS, or sooner when the cache grows past
 * WM_CACHE_MAX_BYTES.
 */
import crypto from 'crypto'
import fsp from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { uploadDir } from '@/lib/storage'
import { GLYPH_ADVANCE, GLYPH_PATH } from '@/lib/watermark-glyphs'

/** Bump when the look changes so cached copies are re-rendered. */
const WM_VERSION = 'wm1'
const WM_CACHE_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000
const WM_CACHE_MAX_BYTES = Number(process.env.WM_CACHE_MAX_BYTES) || 2 * 1024 * 1024 * 1024
const SWEEP_EVERY_MS = 60 * 60 * 1000
const MAX_INPUT_PIXELS = 60_000_000

export type WatermarkSpec =
  | { kind: 'viewer'; viewerId: string; username: string }
  | { kind: 'anon' }

/** Today's date in South Africa (SAST), YYYY-MM-DD. */
export function sastDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

// ── Text as SVG paths ───────────────────────────────────────────────────────

function glyphFor(ch: string): string {
  return ch in GLYPH_ADVANCE ? ch : '_'
}

/** Width in px of `text` at `size` px. */
export function measureText(text: string, size: number): number {
  let w = 0
  for (const ch of text) w += GLYPH_ADVANCE[glyphFor(ch)]
  return (w * size) / 1000
}

/** `<g>` drawing `text` with its baseline-left at (x, y), `size` px tall em. */
function textGroup(text: string, x: number, y: number, size: number, attrs: string): string {
  const k = size / 1000
  let cx = 0
  let paths = ''
  for (const raw of text) {
    const ch = glyphFor(raw)
    const d = GLYPH_PATH[ch]
    if (d) paths += `<path transform="translate(${cx} 0)" d="${d}"/>`
    cx += GLYPH_ADVANCE[ch]
  }
  return `<g transform="translate(${r(x)} ${r(y)}) scale(${k.toFixed(5)})" ${attrs}>${paths}</g>`
}

const r = (n: number) => Math.round(n * 10) / 10

/** Keep only characters we have glyphs for; usernames are [A-Za-z0-9_.-] already. */
function cleanName(name: string): string {
  return name.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 30) || 'member'
}

const ANGLE = (-30 * Math.PI) / 180 // text runs up and to the right

interface Layout {
  fs: number
  tileText: string
  stepX: number
  stepY: number
  cs: number
  cornerText: string
}

function layoutFor(width: number, height: number, spec: WatermarkSpec, date: string): Layout {
  const short = Math.min(width, height)
  const fs = clamp(Math.round(short * 0.026), 11, 40)
  const tileText = spec.kind === 'viewer' ? `@${cleanName(spec.username)} · hush · ${date}` : 'HUSH · members only'
  return {
    fs,
    tileText,
    // Gap between repeats along a row, and between rows
    stepX: Math.ceil(measureText(tileText, fs) + fs * 3.5),
    stepY: Math.ceil(fs * 4.2),
    cs: clamp(Math.round(short * 0.021), 10, 28),
    cornerText: spec.kind === 'viewer' ? `HUSH · @${cleanName(spec.username)}` : 'HUSH',
  }
}

/**
 * One copy of the repeating text, already rotated, as a small SVG: white at
 * ~13% with a faint dark outline so it reads on light and dark photos.
 * (ax, ay) is where the text's baseline origin lands inside the SVG.
 */
export function stripSvg(text: string, fs: number): { svg: string; w: number; h: number; ax: number; ay: number } {
  const tw = measureText(text, fs)
  const pad = 2
  // Unrotated text box: x ∈ [0, tw], y ∈ [-0.8 fs, 0.25 fs]
  const box = [[-pad, -0.8 * fs - pad], [tw + pad, -0.8 * fs - pad], [tw + pad, 0.25 * fs + pad], [-pad, 0.25 * fs + pad]]
  const cos = Math.cos(ANGLE)
  const sin = Math.sin(ANGLE)
  const rot = box.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos])
  const minX = Math.min(...rot.map((p) => p[0]))
  const minY = Math.min(...rot.map((p) => p[1]))
  const w = Math.ceil(Math.max(...rot.map((p) => p[0])) - minX) + 1
  const h = Math.ceil(Math.max(...rot.map((p) => p[1])) - minY) + 1
  const ax = -minX
  const ay = -minY
  const strokeUnits = (Math.max(0.8, fs * 0.05) * 1000) / fs // outline px → glyph units
  const attrs = `fill="#fff" fill-opacity="0.13" stroke="#000" stroke-opacity="0.13" stroke-width="${r(strokeUnits)}" stroke-linejoin="round"`
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<g transform="translate(${r(ax)} ${r(ay)}) rotate(${(ANGLE * 180) / Math.PI})">${textGroup(text, 0, 0, fs, attrs)}</g>` +
    `</svg>`
  return { svg, w, h, ax, ay }
}

/** The solid corner mark ("HUSH · @viewer" on a dark pill). */
export function cornerSvg(text: string, cs: number): { svg: string; w: number; h: number } {
  const padX = cs * 0.6
  const w = Math.ceil(measureText(text, cs) + padX * 2)
  const h = Math.ceil(cs * 1.55)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="${w}" height="${h}" rx="${r(h / 2)}" fill="#000" fill-opacity="0.38"/>` +
    textGroup(text, padX, h / 2 + cs * 0.36, cs, 'fill="#fff" fill-opacity="0.85"') +
    `</svg>`
  return { svg, w, h }
}

/** Non-transparent pixels of a small rendered SVG, for fast repeated blending. */
interface Sprite {
  w: number
  h: number
  ax: number
  ay: number
  /** x | y << 16 of each non-transparent pixel */
  idx: Int32Array
  /** Premultiplied colour (r·a, g·a, b·a) per pixel */
  pm: Uint16Array
  /** 255 − alpha per pixel */
  ia: Uint8Array
}

const spriteCache = new Map<string, Promise<Sprite>>()

function sprite(key: string, make: () => { svg: string; ax: number; ay: number }): Promise<Sprite> {
  let p = spriteCache.get(key)
  if (!p) {
    p = (async () => {
      const s = make()
      const { data, info } = await sharp(Buffer.from(s.svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const idx: number[] = []
      const pm: number[] = []
      const ia: number[] = []
      for (let i = 0, n = info.width * info.height; i < n; i++) {
        const a = data[i * 4 + 3]
        if (!a) continue
        idx.push((i % info.width) | (Math.floor(i / info.width) << 16))
        pm.push(data[i * 4] * a, data[i * 4 + 1] * a, data[i * 4 + 2] * a)
        ia.push(255 - a)
      }
      return { w: info.width, h: info.height, ax: s.ax, ay: s.ay, idx: Int32Array.from(idx), pm: Uint16Array.from(pm), ia: Uint8Array.from(ia) }
    })()
    spriteCache.set(key, p)
    if (spriteCache.size > 128) spriteCache.delete(spriteCache.keys().next().value as string)
    p.catch(() => spriteCache.delete(key))
  }
  return p
}

/** Alpha-blend `sp` onto an RGB(A) pixel buffer with its top-left at (ox, oy), clipped. */
function blend(img: Buffer, width: number, height: number, channels: number, sp: Sprite, ox: number, oy: number) {
  if (ox >= width || oy >= height || ox + sp.w <= 0 || oy + sp.h <= 0) return
  const { idx, pm, ia } = sp
  const inside = ox >= 0 && oy >= 0 && ox + sp.w <= width && oy + sp.h <= height
  for (let k = 0; k < idx.length; k++) {
    const x = ox + (idx[k] & 0xffff)
    const y = oy + (idx[k] >> 16)
    if (!inside && (x < 0 || y < 0 || x >= width || y >= height)) continue
    const o = (y * width + x) * channels
    const inv = ia[k]
    const p = k * 3
    // (c·a + d·(255−a)) / 255, integer form
    img[o] = ((pm[p] + img[o] * inv + 128) * 257) >>> 16
    img[o + 1] = ((pm[p + 1] + img[o + 1] * inv + 128) * 257) >>> 16
    img[o + 2] = ((pm[p + 2] + img[o + 2] * inv + 128) * 257) >>> 16
  }
}

/**
 * Burn the watermark into decoded pixels: the rotated text repeated on a
 * staggered lattice anchored at the image origin (covers every part of the
 * picture, so it can't be cropped away), plus the corner mark. Rendering one
 * copy as SVG and blending it repeatedly takes a few ms; rasterising the whole
 * overlay as one SVG took ~300 ms at 2048 px, compositing a full-size layer ~60 ms.
 */
async function burnIn(img: Buffer, width: number, height: number, channels: number, L: Layout) {
  const sp = await sprite(`t|${L.fs}|${L.tileText}`, () => stripSvg(L.tileText, L.fs))
  const cos = Math.cos(ANGLE)
  const sin = Math.sin(ANGLE)
  const ux = cos * L.stepX, uy = sin * L.stepX // along the text
  const vx = -sin * L.stepY, vy = cos * L.stepY // to the next row
  // Lattice range covering the image (project its corners onto u and v)
  const corners = [[0, 0], [width, 0], [0, height], [width, height]]
  const is = corners.map(([x, y]) => (x * cos + y * sin) / L.stepX)
  const js = corners.map(([x, y]) => (-x * sin + y * cos) / L.stepY)
  const reach = Math.ceil(Math.hypot(sp.w, sp.h) / Math.min(L.stepX, L.stepY)) + 1
  const i0 = Math.floor(Math.min(...is)) - reach, i1 = Math.ceil(Math.max(...is)) + reach
  const j0 = Math.floor(Math.min(...js)) - reach, j1 = Math.ceil(Math.max(...js)) + reach
  for (let j = j0; j <= j1; j++) {
    const shift = j & 1 ? 0.5 : 0
    for (let i = i0; i <= i1; i++) {
      blend(img, width, height, channels, sp, Math.round((i + shift) * ux + j * vx - sp.ax), Math.round((i + shift) * uy + j * vy - sp.ay))
    }
  }
  const c = await sprite(`c|${L.cs}|${L.cornerText}`, () => ({ ...cornerSvg(L.cornerText, L.cs), ax: 0, ay: 0 }))
  const margin = Math.max(6, Math.round(L.cs * 0.7))
  if (c.w + margin * 2 <= width && c.h + margin * 2 <= height) {
    blend(img, width, height, channels, c, width - margin - c.w, height - margin - c.h)
  }
}

/**
 * Decoded originals, shared by every viewer: decoding a 2048 px WebP is about
 * half the cost of a render, and a popular photo is opened by many members.
 * Bounded by bytes (WM_DECODE_CACHE_BYTES, default 96 MB), least recently used out.
 */
const DECODE_CACHE_BYTES = Number(process.env.WM_DECODE_CACHE_BYTES) || 96 * 1024 * 1024
const decoded = new Map<string, { data: Buffer; width: number; height: number; channels: number }>()
let decodedBytes = 0

async function decode(inputPath: string, fileTag: string) {
  const key = `${inputPath}|${fileTag}`
  const hit = decoded.get(key)
  if (hit) {
    decoded.delete(key)
    decoded.set(key, hit) // most recently used
    return { ...hit, data: Buffer.from(hit.data) } // burnIn writes into it
  }
  const { data, info } = await sharp(inputPath, { limitInputPixels: MAX_INPUT_PIXELS }).raw().toBuffer({ resolveWithObject: true })
  const entry = { data, width: info.width, height: info.height, channels: info.channels }
  if (data.length <= DECODE_CACHE_BYTES / 4) {
    decoded.set(key, { ...entry, data: Buffer.from(data) })
    decodedBytes += data.length
    for (const [k, v] of decoded) {
      if (decodedBytes <= DECODE_CACHE_BYTES) break
      decoded.delete(k)
      decodedBytes -= v.data.length
    }
  }
  return entry
}

/** Watermark the image file at `inputPath`; returns WebP bytes. */
export async function renderWatermarked(inputPath: string, spec: WatermarkSpec, date = sastDate(), fileTag = ''): Promise<Buffer> {
  const { data, width, height, channels } = await decode(inputPath, fileTag)
  if (!width || !height || (channels !== 3 && channels !== 4)) throw new Error('Unreadable image')
  await burnIn(data, width, height, channels, layoutFor(width, height, spec, date))
  return sharp(data, { raw: { width, height, channels: channels as 3 | 4 } })
    .webp({ quality: 82, effort: WEBP_EFFORT })
    .toBuffer()
}

/**
 * libwebp effort 0–6. 0 encodes a 2048 px image in ~60 ms instead of ~150 ms
 * (default 4) at the same quality setting; files are ~35% larger.
 */
const WEBP_EFFORT = 0

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n))
}

// ── Disk cache ──────────────────────────────────────────────────────────────

function cacheRoot(): string {
  return path.join(uploadDir(), '.wm-cache')
}

/**
 * Cache identity for one viewer + day (or the anonymous mark). `fileTag`
 * (e.g. the stored file's size) re-renders when the source changes.
 */
export function watermarkHash(spec: WatermarkSpec, date: string, fileTag: string): string {
  const who = spec.kind === 'viewer' ? `${spec.viewerId}|${spec.username}|${date}` : 'anon'
  return crypto.createHash('sha256').update(`${WM_VERSION}|${who}|${fileTag}`).digest('hex')
}

const inflight = new Map<string, Promise<Buffer>>()

/**
 * Watermarked bytes for one photo variant, from the disk cache when possible.
 * `photoId` must already be validated (route ID_RE); `variant` is fixed.
 * Concurrent requests for the same copy share one render.
 */
export async function getWatermarked(opts: {
  photoId: string
  variant: 'full' | 'thumb'
  inputPath: string
  /** Changes when the stored file changes (e.g. its size + mtime) */
  fileTag: string
  spec: WatermarkSpec
  date: string
  /** watermarkHash(spec, date, fileTag) */
  hash: string
}): Promise<{ data: Buffer; cached: boolean }> {
  if (!/^[a-z0-9]{20,40}$/i.test(opts.photoId) || !/^[a-f0-9]{64}$/.test(opts.hash)) throw new Error('Invalid cache key')
  const dir = path.join(cacheRoot(), opts.photoId, opts.variant)
  const file = path.join(dir, `${opts.hash}.webp`)
  maybeSweep()

  try {
    return { data: await fsp.readFile(file), cached: true }
  } catch {
    /* miss */
  }

  let job = inflight.get(file)
  if (!job) {
    job = (async () => {
      const data = await renderWatermarked(opts.inputPath, opts.spec, opts.date, opts.fileTag)
      // Best effort: a full disk must never break image serving
      try {
        await fsp.mkdir(dir, { recursive: true })
        const tmp = `${file}.${crypto.randomBytes(4).toString('hex')}.tmp`
        await fsp.writeFile(tmp, data, { mode: 0o640 })
        await fsp.rename(tmp, file)
      } catch (e) {
        console.warn('[watermark] cache write failed:', e instanceof Error ? e.message : e)
      }
      return data
    })().finally(() => inflight.delete(file))
    inflight.set(file, job)
  }
  return { data: await job, cached: false }
}

let lastSweep = 0
let sweeping = false

/** At most hourly, in the background: drop stale copies and enforce the size cap. */
function maybeSweep() {
  const now = Date.now()
  if (sweeping || now - lastSweep < SWEEP_EVERY_MS) return
  lastSweep = now
  sweeping = true
  sweepWatermarkCache().catch((e) => console.warn('[watermark] sweep failed:', e instanceof Error ? e.message : e)).finally(() => { sweeping = false })
}

/** Delete cached copies older than the max age; then oldest-first until under the cap. */
export async function sweepWatermarkCache(now = Date.now()): Promise<{ deleted: number; kept: number; bytes: number }> {
  const root = cacheRoot()
  const files: Array<{ p: string; size: number; mtime: number }> = []
  let deleted = 0
  const ids = await fsp.readdir(root).catch(() => [] as string[])
  for (const id of ids) {
    const idDir = path.join(root, id)
    const variants = await fsp.readdir(idDir).catch(() => [] as string[])
    for (const v of variants) {
      const vDir = path.join(idDir, v)
      const names = await fsp.readdir(vDir).catch(() => [] as string[])
      for (const n of names) {
        const p = path.join(vDir, n)
        const st = await fsp.stat(p).catch(() => null)
        if (!st?.isFile()) continue
        // Stale renders and leftover temp files
        if (now - st.mtimeMs > WM_CACHE_MAX_AGE_MS || (n.endsWith('.tmp') && now - st.mtimeMs > 60_000)) {
          await fsp.unlink(p).catch(() => {})
          deleted++
        } else {
          files.push({ p, size: st.size, mtime: st.mtimeMs })
        }
      }
      await fsp.rmdir(vDir).catch(() => {}) // only succeeds when empty
    }
    await fsp.rmdir(idDir).catch(() => {})
  }
  let bytes = files.reduce((s, f) => s + f.size, 0)
  if (bytes > WM_CACHE_MAX_BYTES) {
    files.sort((a, b) => a.mtime - b.mtime)
    for (const f of files) {
      if (bytes <= WM_CACHE_MAX_BYTES * 0.8) break
      await fsp.unlink(f.p).catch(() => {})
      bytes -= f.size
      deleted++
    }
  }
  return { deleted, kept: files.length, bytes }
}

/** Remove every cached copy of one photo (call after deleting it). */
export async function purgeWatermarks(photoId: string): Promise<void> {
  if (!/^[a-z0-9]{20,40}$/i.test(photoId)) return
  await fsp.rm(path.join(cacheRoot(), photoId), { recursive: true, force: true }).catch(() => {})
}

/**
 * A small text label as a transparent PNG (white with a dark outline), for
 * burning into videos with ffmpeg's overlay filter — no drawtext/fontconfig
 * needed. `size` is the em size in px.
 */
export async function labelPng(text: string, size: number, opacity = 0.6): Promise<{ png: Buffer; width: number; height: number }> {
  const pad = Math.ceil(size * 0.25)
  const width = Math.ceil(measureText(text, size) + pad * 2)
  const height = Math.ceil(size * 1.3 + pad * 2)
  const strokeUnits = (Math.max(1, size * 0.07) * 1000) / size
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    textGroup(text, pad, pad + size * 0.95, size, `fill="#fff" fill-opacity="${opacity}" stroke="#000" stroke-opacity="${(opacity * 0.6).toFixed(2)}" stroke-width="${r(strokeUnits)}" stroke-linejoin="round" paint-order="stroke"`) +
    `</svg>`
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  return { png, width, height }
}

/** Owner attribution burned into stored videos. */
export function videoLabelText(ownerUsername: string): string {
  return `hush · @${cleanName(ownerUsername)}`
}
