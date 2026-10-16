// Cron runner for a Railway cron service (schedule */15 * * * *; see README
// "Scheduled jobs"). Calls each /api/cron/<job> endpoint of the web service with
// the shared bearer secret, logs one line per job and exits. No dependencies.
//
// Every endpoint is idempotent, so running it more often than needed is safe;
// the heavier ones are still limited to the first run of each hour.
//
// Env:
//   CRON_SECRET            required — same value as on the web service
//   CRON_TARGET_URL        base URL of the web service (falls back to NEXT_PUBLIC_APP_URL).
//                          Use the private URL, e.g. http://<web-service>.railway.internal:<PORT>
//                          to skip the public edge, or the public https URL.
//   CRON_INTERVAL_MINUTES  how often this service runs (default 15); hourly jobs run when the
//                          current UTC minute is below it, i.e. once per hour
//   CRON_JOBS              optional comma-separated subset to run (e.g. "store,view-once")
//   CRON_FORCE=1           ignore the hourly gating (manual runs)
//   CRON_TIMEOUT_MS        per-request timeout (default 120000)

const JOBS = [
  // Claims each attendee row before sending, so it never double-notifies.
  { name: 'event-reminders', every: 'run' },
  // Re-syncs up to 2000 rating aggregates per call: cheap enough hourly, wasteful every 15 min.
  { name: 'reviews', every: 'hour' },
  // Releases unpaid store orders after 30 min — wants the short interval.
  { name: 'store', every: 'run' },
  { name: 'view-once', every: 'run' },
  // Membership expiry + reminder emails (documented as the hourly cron).
  { name: 'subscriptions', every: 'hour' },
  // Lifecycle emails: deduped per member, quiet hours enforced server-side, 200 per run.
  { name: 'lifecycle', every: 'run' },
  // Invite-a-friend rewards the event hooks missed (idempotent).
  { name: 'referrals', every: 'hour' },
]

const secret = process.env.CRON_SECRET
const base = (process.env.CRON_TARGET_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
const interval = Math.max(1, Number(process.env.CRON_INTERVAL_MINUTES) || 15)
const force = process.env.CRON_FORCE === '1'
const timeoutMs = Number(process.env.CRON_TIMEOUT_MS) || 120_000
const only = (process.env.CRON_JOBS || '').split(',').map((s) => s.trim()).filter(Boolean)

function summarize(body) {
  if (body && typeof body === 'object') {
    const parts = Object.entries(body)
      .filter(([k, v]) => k !== 'ok' && (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean'))
      .map(([k, v]) => `${k}=${v}`)
    return parts.join(' ')
  }
  return String(body ?? '').slice(0, 200).replace(/\s+/g, ' ')
}

async function runJob(name) {
  const started = Date.now()
  try {
    const res = await fetch(`${base}/api/cron/${name}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'user-agent': 'unbound-cron/1' },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'manual',
    })
    const ms = Date.now() - started
    const text = await res.text()
    let body = text
    try {
      body = JSON.parse(text)
    } catch {}
    if (res.status === 404) {
      console.warn(`[cron] ${name}: WARN 404 — endpoint not deployed yet (${ms} ms)`)
      return 'skipped'
    }
    if (!res.ok) {
      console.error(`[cron] ${name}: FAIL HTTP ${res.status} (${ms} ms) ${summarize(body)}`)
      return 'failed'
    }
    console.log(`[cron] ${name}: ok (${ms} ms) ${summarize(body)}`)
    return 'ok'
  } catch (e) {
    const reason = e?.name === 'TimeoutError' ? `timed out after ${timeoutMs} ms` : (e?.cause?.code || e?.message || String(e))
    console.error(`[cron] ${name}: FAIL ${reason}`)
    return 'failed'
  }
}

async function main() {
  if (!secret) {
    console.error('[cron] CRON_SECRET is not set')
    process.exit(1)
  }
  if (!/^https?:\/\//.test(base)) {
    console.error('[cron] set CRON_TARGET_URL (or NEXT_PUBLIC_APP_URL) to the web service URL, e.g. https://unboundza.com')
    process.exit(1)
  }

  const minute = new Date().getUTCMinutes()
  const due = JOBS.filter((j) => (only.length ? only.includes(j.name) : true)).filter(
    (j) => force || only.length > 0 || j.every === 'run' || minute < interval
  )
  const notDue = JOBS.filter((j) => !due.includes(j) && (!only.length || only.includes(j.name)))
  for (const j of notDue) console.log(`[cron] ${j.name}: not due (runs in the first run of each hour)`)

  // Sequential: keeps load on the single web instance low and the log ordered.
  const results = []
  for (const j of due) results.push(await runJob(j.name))

  const ok = results.filter((r) => r === 'ok').length
  const failed = results.filter((r) => r === 'failed').length
  const skipped = results.filter((r) => r === 'skipped').length
  console.log(`[cron] done: ${ok} ok, ${failed} failed, ${skipped} not deployed, ${notDue.length} not due`)
  // Exit non-zero only when nothing worked (e.g. wrong URL/secret, web service down).
  process.exit(failed > 0 && ok === 0 ? 1 : 0)
}

main()
