// Nightly logical database backup → S3-compatible bucket (Railway Buckets,
// Cloudflare R2, S3, MinIO). Run by a Railway cron service (`0 1 * * *`, see
// README "Database backups"); restore with scripts/restore.md.
//
//   1. pg_dump -Fc (custom format: already compressed, restorable selectively
//      with pg_restore) to a temp file, then `pg_restore --list` to check it.
//   2. Upload to <bucket>/<prefix>unbound-YYYY-MM-DDTHH-mm.dump (UTC), as a single
//      PUT up to 64 MiB, multipart above that (memory stays bounded).
//   3. Delete backups older than BACKUP_RETENTION_DAYS (only files this script
//      names, always keeping the newest BACKUP_MIN_KEEP).
//
// Env:
//   BACKUP_DATABASE_URL | DATABASE_URL     database to dump
//   BACKUP_S3_ENDPOINT                     e.g. https://t3.storageapi.dev, https://<acct>.r2.cloudflarestorage.com
//   BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY
//   BACKUP_S3_REGION        default "auto"
//   BACKUP_S3_URL_STYLE     "virtual" (default: bucket as subdomain — Railway, R2, S3) or "path" (MinIO)
//   BACKUP_PREFIX           default "backups/"
//   BACKUP_RETENTION_DAYS   default 30 (0 = never delete)
//   BACKUP_MIN_KEEP         default 3
//   PG_DUMP_PATH / PG_RESTORE_PATH   optional binary paths
// Exits non-zero if the dump or upload fails (pruning problems only warn).
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtemp, open, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { AwsClient } from 'aws4fetch'

// Multipart part size (S3 minimum 5 MiB); BACKUP_PART_MB is only meant for tests.
const PART_SIZE = Math.max(5, Number(process.env.BACKUP_PART_MB) || 64) * 1024 * 1024
const NAME_RE = /^unbound-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2})\.dump$/

const log = (...a) => console.log('[backup]', ...a)

// ---------- helpers (exported for tests) ----------

/** backups/unbound-2026-10-15T01-00.dump (UTC). */
export function backupKey(prefix, date = new Date()) {
  const iso = date.toISOString() // 2026-10-15T01:00:12.345Z
  return `${prefix}unbound-${iso.slice(0, 10)}T${iso.slice(11, 13)}-${iso.slice(14, 16)}.dump`
}

/** Prisma-style URLs carry params libpq rejects (schema, connection_limit, pgbouncer…). */
export function libpqUrl(raw) {
  const u = new URL(raw)
  const allowed = new Set([
    'host', 'hostaddr', 'port', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslpassword',
    'connect_timeout', 'application_name', 'options', 'target_session_attrs', 'channel_binding',
  ])
  for (const k of [...u.searchParams.keys()]) if (!allowed.has(k)) u.searchParams.delete(k)
  return u.toString()
}

/** RFC 3986 encoding per path segment (S3 canonical URI). */
const encodeKey = (key) => key.split('/').map((s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)).join('/')

export function makeS3({ endpoint, bucket, accessKeyId, secretAccessKey, region = 'auto', urlStyle = 'virtual', fetchImpl }) {
  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region })
  const ep = new URL(endpoint)
  const bucketBase =
    urlStyle === 'path'
      ? `${ep.origin}${ep.pathname.replace(/\/+$/, '')}/${encodeURIComponent(bucket)}`
      : `${ep.protocol}//${bucket}.${ep.host}${ep.pathname.replace(/\/+$/, '')}`

  const url = (key = '', query = {}) => {
    const u = new URL(`${bucketBase}/${key ? encodeKey(key) : ''}`)
    for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v)
    return u.toString()
  }

  // Signs with the real payload hash (the server verifies the bytes), retries
  // network errors / 5xx / 429 up to 3 attempts in total.
  async function call(method, key, { query, body, headers = {} } = {}) {
    const payloadHash = createHash('sha256').update(body ?? '').digest('hex')
    let lastErr
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const req = await aws.sign(url(key, query), { method, body, headers: { ...headers, 'x-amz-content-sha256': payloadHash } })
        // Send the raw body, not the signed Request: a Request's body is a stream, which
        // fetch sends chunked with no Content-Length, and S3 rejects that (411).
        const res = await (fetchImpl ?? fetch)(req.url, { method, headers: req.headers, body, signal: AbortSignal.timeout(10 * 60_000) })
        const text = await res.text()
        if (res.ok) return { res, text }
        const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1]
        lastErr = new Error(`S3 ${method} ${key || '/'}${query ? '?' + new URLSearchParams(query) : ''} → HTTP ${res.status}${code ? ` ${code}` : ''}`)
        if (res.status < 500 && res.status !== 429) break
      } catch (e) {
        lastErr = e
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
    }
    throw lastErr
  }

  return {
    url,
    put: (key, buf, contentType = 'application/octet-stream') =>
      call('PUT', key, { body: buf, headers: { 'content-type': contentType } }),
    async createMultipart(key) {
      const { text } = await call('POST', key, { query: { uploads: '' }, headers: { 'content-type': 'application/octet-stream' } })
      const id = /<UploadId>([^<]+)<\/UploadId>/.exec(text)?.[1]
      if (!id) throw new Error('CreateMultipartUpload: no UploadId in response')
      return id
    },
    async uploadPart(key, uploadId, partNumber, buf) {
      const { res } = await call('PUT', key, { query: { partNumber: String(partNumber), uploadId }, body: buf })
      const etag = res.headers.get('etag')
      if (!etag) throw new Error(`UploadPart ${partNumber}: no ETag`)
      return etag
    },
    completeMultipart: (key, uploadId, etags) =>
      call('POST', key, {
        query: { uploadId },
        headers: { 'content-type': 'application/xml' },
        body:
          '<CompleteMultipartUpload>' +
          etags.map((e, i) => `<Part><PartNumber>${i + 1}</PartNumber><ETag>${e.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</ETag></Part>`).join('') +
          '</CompleteMultipartUpload>',
      }),
    abortMultipart: (key, uploadId) => call('DELETE', key, { query: { uploadId } }),
    async list(prefix) {
      const out = []
      let token
      do {
        const query = { 'list-type': '2', prefix }
        if (token) query['continuation-token'] = token
        const { text } = await call('GET', '', { query })
        for (const m of text.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
          const key = /<Key>([^<]*)<\/Key>/.exec(m[1])?.[1]
          const lastModified = /<LastModified>([^<]*)<\/LastModified>/.exec(m[1])?.[1]
          const size = Number(/<Size>([^<]*)<\/Size>/.exec(m[1])?.[1] ?? 0)
          if (key) out.push({ key: xmlDecode(key), lastModified: lastModified ? new Date(lastModified) : null, size })
        }
        token = /<IsTruncated>true<\/IsTruncated>/.test(text)
          ? xmlDecode(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(text)?.[1] ?? '')
          : undefined
      } while (token)
      return out
    },
    del: (key) => call('DELETE', key),
  }
}

const xmlDecode = (s) =>
  s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_, e) =>
    ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[e.toLowerCase()] ??
    String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
  )

/** Which listed objects to delete: our own names only, older than the cutoff, never the newest `minKeep`. */
export function selectExpired(objects, prefix, { retentionDays, minKeep, now = new Date(), keep = [] }) {
  if (!retentionDays || retentionDays <= 0) return []
  const cutoff = now.getTime() - retentionDays * 86400_000
  const ours = objects
    .filter((o) => o.key.startsWith(prefix) && NAME_RE.test(o.key.slice(prefix.length)))
    .map((o) => {
      const stamp = NAME_RE.exec(o.key.slice(prefix.length))[1]
      const fromName = Date.parse(`${stamp.slice(0, 13)}:${stamp.slice(14)}:00Z`)
      return { ...o, time: Number.isFinite(fromName) ? fromName : o.lastModified?.getTime() ?? Infinity }
    })
    .sort((a, b) => b.time - a.time)
  return ours.slice(Math.max(0, minKeep)).filter((o) => o.time < cutoff && !keep.includes(o.key)).map((o) => o.key)
}

// ---------- main ----------

function run(cmd, args, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', capture ? 'pipe' : 'ignore', 'pipe'] })
    let stderr = ''
    let stdout = ''
    p.stderr.on('data', (d) => (stderr += d))
    p.stdout?.on('data', (d) => (stdout += d))
    p.on('error', (e) => reject(new Error(`${cmd}: ${e.code === 'ENOENT' ? 'not installed (build from ops/backup/Dockerfile)' : e.message}`)))
    p.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(`${cmd} exited ${code}: ${stderr.trim().slice(-2000)}`))))
  })
}

async function upload(s3, key, file, size) {
  if (size <= PART_SIZE) {
    const fh = await open(file)
    try {
      await s3.put(key, await fh.readFile())
    } finally {
      await fh.close()
    }
    return
  }
  const uploadId = await s3.createMultipart(key)
  try {
    const etags = []
    const fh = await open(file)
    try {
      for (let offset = 0, part = 1; offset < size; offset += PART_SIZE, part++) {
        const buf = Buffer.alloc(Math.min(PART_SIZE, size - offset))
        await fh.read(buf, 0, buf.length, offset)
        etags.push(await s3.uploadPart(key, uploadId, part, buf))
      }
    } finally {
      await fh.close()
    }
    await s3.completeMultipart(key, uploadId, etags)
  } catch (e) {
    await s3.abortMultipart(key, uploadId).catch(() => {})
    throw e
  }
}

async function main() {
  const env = process.env
  const dbUrl = env.BACKUP_DATABASE_URL || env.DATABASE_URL
  const missing = ['BACKUP_S3_ENDPOINT', 'BACKUP_S3_BUCKET', 'BACKUP_S3_ACCESS_KEY_ID', 'BACKUP_S3_SECRET_ACCESS_KEY'].filter((k) => !env[k])
  if (!dbUrl) missing.unshift('DATABASE_URL')
  if (missing.length) throw new Error(`missing env: ${missing.join(', ')}`)

  const prefix = env.BACKUP_PREFIX ?? 'backups/'
  const retentionDays = env.BACKUP_RETENTION_DAYS === undefined || env.BACKUP_RETENTION_DAYS === '' ? 30 : Number(env.BACKUP_RETENTION_DAYS)
  const minKeep = env.BACKUP_MIN_KEEP ? Number(env.BACKUP_MIN_KEEP) : 3
  const s3 = makeS3({
    endpoint: env.BACKUP_S3_ENDPOINT,
    bucket: env.BACKUP_S3_BUCKET,
    accessKeyId: env.BACKUP_S3_ACCESS_KEY_ID,
    secretAccessKey: env.BACKUP_S3_SECRET_ACCESS_KEY,
    region: env.BACKUP_S3_REGION || 'auto',
    urlStyle: env.BACKUP_S3_URL_STYLE === 'path' ? 'path' : 'virtual',
  })

  const pgDump = env.PG_DUMP_PATH || 'pg_dump'
  const pgRestore = env.PG_RESTORE_PATH || 'pg_restore'
  const version = spawnSync(pgDump, ['--version'], { encoding: 'utf8' })
  if (version.error) throw new Error(`${pgDump} not found — build this service from ops/backup/Dockerfile (postgresql-client-18)`)
  log(version.stdout.trim())

  const dir = await mkdtemp(join(tmpdir(), 'unbound-backup-'))
  const file = join(dir, 'db.dump')
  const key = backupKey(prefix)
  const started = Date.now()
  try {
    // Custom format is compressed (zlib) already, so no extra gzip; --no-owner/--no-acl
    // keep it restorable into a database with a different role.
    await run(pgDump, ['--format=custom', '--compress=6', '--no-owner', '--no-acl', '--file', file, '--dbname', libpqUrl(dbUrl)])
    await run(pgRestore, ['--list', file], { capture: true }) // fails on a truncated/corrupt archive
    const { size } = await stat(file)
    log(`dumped ${(size / 1048576).toFixed(1)} MiB in ${((Date.now() - started) / 1000).toFixed(1)} s`)

    await upload(s3, key, file, size)
    log(`uploaded s3://${env.BACKUP_S3_BUCKET}/${key}`)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }

  try {
    const objects = await s3.list(prefix)
    if (!objects.some((o) => o.key === key)) throw new Error(`just-uploaded ${key} not in listing — skipping prune`)
    const expired = selectExpired(objects, prefix, { retentionDays, minKeep, keep: [key] })
    for (const k of expired) {
      await s3.del(k)
      log(`deleted expired ${k}`)
    }
    log(`retention ${retentionDays || '∞'} days: ${objects.length - expired.length} object(s) kept under the prefix, ${expired.length} expired backup(s) deleted`)
  } catch (e) {
    console.warn('[backup] WARNING: pruning failed (the backup itself succeeded):', e instanceof Error ? e.message : e)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().then(
    () => process.exit(0),
    (e) => {
      console.error('[backup] FAILED:', e instanceof Error ? e.message : e)
      process.exit(1)
    }
  )
}
