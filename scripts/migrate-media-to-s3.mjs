#!/usr/bin/env node
/**
 * Copy every stored media file from UPLOAD_DIR (the Railway volume) into the
 * S3-compatible bucket configured by S3_* (see lib/storage.ts and the README,
 * "Media storage (S3 / Railway Buckets / R2)"). Keys stay identical, so no
 * database rows change.
 *
 *   node scripts/migrate-media-to-s3.mjs [--dry-run] [--delete-local] [--concurrency=4]
 *
 * - Resumable / idempotent: a file whose key is already in the bucket with
 *   the same size is skipped, so it can simply be run again after a failure.
 * - Every upload is verified with HeadObject (size) afterwards.
 * - --dry-run lists what would be uploaded, writes nothing.
 * - --delete-local removes a local file only once the bucket copy is verified
 *   (default off — keep the volume until you've checked the site).
 * - Ignores the watermark cache (.wm-cache), temp files and anything that
 *   isn't a storage key. Exits 1 if any file failed.
 *
 * Env: UPLOAD_DIR, S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID,
 * S3_SECRET_ACCESS_KEY, S3_REGION (default "auto"), S3_FORCE_PATH_STYLE.
 */
import { AwsClient } from 'aws4fetch'
import fsp from 'node:fs/promises'
import path from 'node:path'

const KEY_RE = /^\d{4}\/\d{2}\/[a-f0-9]{32}(?:_t)?\.(?:webp|mp4|webm|mov|m4a|ogg|weba)$/
const CONTENT_TYPES = {
  webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  m4a: 'audio/mp4', ogg: 'audio/ogg', weba: 'audio/webm',
}

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`))
  return a ? a.slice(name.length + 3) : def
}
if (flag('help') || flag('h')) {
  console.log('Usage: node scripts/migrate-media-to-s3.mjs [--dry-run] [--delete-local] [--concurrency=4]')
  process.exit(0)
}
const DRY = flag('dry-run')
const DELETE_LOCAL = flag('delete-local')
const CONCURRENCY = Math.max(1, Math.min(32, Number(opt('concurrency', '4')) || 4))

const env = process.env
const root = path.resolve(env.UPLOAD_DIR?.trim() || path.join(process.cwd(), '.uploads'))
const bucket = env.S3_BUCKET?.trim()
const endpoint = env.S3_ENDPOINT?.trim()
const accessKeyId = env.S3_ACCESS_KEY_ID?.trim()
const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim()
const region = env.S3_REGION?.trim() || 'auto'
const pathStyle = /^(1|true|yes)$/i.test(env.S3_FORCE_PATH_STYLE?.trim() ?? '')
if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
  console.error('[migrate-media] Set S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.')
  process.exit(2)
}

const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region, retries: 4 })
const ep = new URL(endpoint.replace(/\/+$/, ''))
const basePath = ep.pathname.replace(/\/+$/, '')
const bucketUrl = pathStyle
  ? `${ep.protocol}//${ep.host}${basePath}/${encodeURIComponent(bucket)}`
  : `${ep.protocol}//${bucket}.${ep.host}${basePath}`
const objectUrl = (key) => `${bucketUrl}/${key}`

async function s3(method, url, init = {}) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(new Error(`${method} timed out`)), 120_000)
  try {
    return await client.fetch(url, { method, ...init, signal: ac.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function headSize(key) {
  const res = await s3('HEAD', objectUrl(key))
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HEAD ${key}: ${res.status}`)
  return Number(res.headers.get('content-length'))
}

/** key → size of everything already in the bucket (ListObjectsV2), or null if listing isn't allowed. */
async function listBucket() {
  const sizes = new Map()
  let token = ''
  for (;;) {
    const q = new URLSearchParams({ 'list-type': '2', 'max-keys': '1000' })
    if (token) q.set('continuation-token', token)
    const res = await s3('GET', `${bucketUrl}/?${q}`)
    const xml = await res.text()
    if (!res.ok) {
      console.warn(`[migrate-media] ListObjectsV2 failed (${res.status}) — checking each file with HeadObject instead`)
      return null
    }
    for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = /<Key>([^<]*)<\/Key>/.exec(m[1])?.[1]
      const size = /<Size>(\d+)<\/Size>/.exec(m[1])?.[1]
      if (key) sizes.set(decodeXml(key), Number(size))
    }
    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml)
    token = decodeXml(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(xml)?.[1] ?? '')
    if (!truncated || !token) return sizes
  }
}

function decodeXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

/** Relative keys of all files under root (skips the watermark cache and temp files). */
async function walk(dir, out, skipped) {
  let entries
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true })
  } catch (e) {
    if (dir === root) throw new Error(`Cannot read UPLOAD_DIR ${root}: ${e.message}`)
    return
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (dir === root && e.name === '.wm-cache') continue
      await walk(full, out, skipped)
    } else if (e.isFile()) {
      const key = path.relative(root, full).split(path.sep).join('/')
      if (KEY_RE.test(key)) out.push(key)
      else skipped.push(key)
    }
  }
}

const fmt = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} GB` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${(n / 1e3).toFixed(1)} KB`)

async function main() {
  const started = Date.now()
  console.log(`[migrate-media] ${root} → ${bucketUrl}${DRY ? '  (dry run)' : ''}${DELETE_LOCAL ? '  (--delete-local)' : ''}, concurrency ${CONCURRENCY}`)
  const keys = []
  const skipped = []
  await walk(root, keys, skipped)
  keys.sort()
  console.log(`[migrate-media] ${keys.length} media files found${skipped.length ? `, ${skipped.length} other files ignored` : ''}`)

  const remote = await listBucket()
  if (remote) console.log(`[migrate-media] bucket already holds ${remote.size} objects`)

  const s = { present: 0, uploaded: 0, wouldUpload: 0, failed: 0, deleted: 0, bytes: 0 }
  const failures = []
  let done = 0
  const queue = [...keys]

  async function one(key) {
    const full = path.join(root, ...key.split('/'))
    const st = await fsp.stat(full)
    const have = remote ? (remote.has(key) ? remote.get(key) : null) : await headSize(key)
    let verified = false
    if (have === st.size) {
      s.present++
      verified = true
    } else if (DRY) {
      s.wouldUpload++
      s.bytes += st.size
      console.log(`  would upload ${key} (${fmt(st.size)})${have !== null ? ` — bucket copy is ${have} bytes` : ''}`)
    } else {
      const data = await fsp.readFile(full)
      const res = await s3('PUT', objectUrl(key), {
        headers: { 'Content-Type': CONTENT_TYPES[key.slice(key.lastIndexOf('.') + 1)] ?? 'application/octet-stream' },
        body: data,
      })
      if (!res.ok) throw new Error(`PUT ${key}: ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`)
      await res.body?.cancel().catch(() => {})
      const after = await headSize(key)
      if (after !== data.length) throw new Error(`verify ${key}: bucket has ${after} bytes, local ${data.length}`)
      s.uploaded++
      s.bytes += data.length
      verified = true
    }
    if (verified && DELETE_LOCAL && !DRY) {
      // Re-check right before deleting (never delete on a stale listing)
      if ((await headSize(key)) === st.size) {
        await fsp.unlink(full)
        s.deleted++
      }
    }
  }

  async function worker() {
    for (let key = queue.shift(); key; key = queue.shift()) {
      try {
        await one(key)
      } catch (e) {
        s.failed++
        failures.push(`${key}: ${e.message}`)
        console.error(`  FAILED ${key}: ${e.message}`)
      }
      done++
      if (done % 200 === 0) console.log(`[migrate-media] ${done}/${keys.length} …`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const secs = ((Date.now() - started) / 1000).toFixed(1)
  console.log('\n[migrate-media] summary')
  console.log(`  media files         ${keys.length}`)
  console.log(`  already in bucket   ${s.present}`)
  if (DRY) console.log(`  would upload        ${s.wouldUpload} (${fmt(s.bytes)})`)
  else console.log(`  uploaded + verified ${s.uploaded} (${fmt(s.bytes)})`)
  if (DELETE_LOCAL) console.log(`  local files deleted ${s.deleted}`)
  console.log(`  failed              ${s.failed}`)
  if (skipped.length) console.log(`  ignored (not media) ${skipped.length}`)
  console.log(`  time                ${secs}s`)
  if (failures.length) {
    console.log('\nRe-run the script to retry the failed files (finished ones are skipped).')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('[migrate-media] fatal:', e.message ?? e)
  process.exit(1)
})
