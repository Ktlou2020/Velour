// Applies Prisma migrations on start (railway.toml), replacing the old
// `prisma db push --accept-data-loss`. Exits non-zero on any failure so the
// app is never started against a schema it doesn't expect: on Railway the
// start command fails, the new deployment never passes its healthcheck and
// the previous deployment keeps serving traffic.
//
//   1. Empty database                    → `prisma migrate deploy` (creates everything).
//   2. Already managed by Migrate        → `prisma migrate deploy` (applies pending ones; no-op otherwise).
//   3. Tables but no migration history   → the database was created by `db push`. Baseline it:
//        a. live schema == prisma/schema.prisma (all migrations' end state)
//             → mark every migration as applied, then deploy (no-op).
//        b. live schema == prisma/baseline/0_init.prisma (what 0_init creates)
//             → mark 0_init as applied, then deploy (applies the follow-ups).
//        c. neither → REFUSE: print the drift and exit 1. Marking 0_init as applied over a
//             database that doesn't match it would make later migrations fail half-way or
//             leave the app running against missing columns. Fix the drift (see README,
//             "Database migrations"), or set MIGRATE_BASELINE_ALLOW_DRIFT=1 for one deploy
//             to baseline 0_init anyway.
//
// No shadow database is needed: the drift checks use `prisma migrate diff --from-url
// <live db> --to-schema-datamodel <file> --exit-code`, which only reads the live schema.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCHEMA = join(ROOT, 'prisma', 'schema.prisma')
const MIGRATIONS = join(ROOT, 'prisma', 'migrations')
const BASELINE = '0_init'
const BASELINE_SCHEMA = join(ROOT, 'prisma', 'baseline', `${BASELINE}.prisma`)
const PRISMA_BIN = join(ROOT, 'node_modules', 'prisma', 'build', 'index.js')

const log = (...a) => console.log('[migrate]', ...a)
const fail = (...a) => {
  console.error('[migrate] ERROR:', ...a)
  process.exit(1)
}

/** Runs the Prisma CLI; returns { status, stdout, stderr }. */
function prisma(args, { quiet = false } = {}) {
  const cmd = existsSync(PRISMA_BIN) ? process.execPath : 'npx'
  const argv = existsSync(PRISMA_BIN) ? [PRISMA_BIN, ...args] : ['--no-install', 'prisma', ...args]
  const r = spawnSync(cmd, argv, {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
  })
  if (r.error) fail(`could not run prisma ${args[0]}:`, r.error.message)
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

/** 0 = live DB matches the datamodel, 2 = it differs (SQL to reconcile in .sql), 1 = error. */
function diffLiveAgainst(datamodel) {
  const r = prisma(
    ['migrate', 'diff', '--from-url', process.env.DATABASE_URL, '--to-schema-datamodel', datamodel, '--script', '--exit-code'],
    { quiet: true }
  )
  if (r.status === 1) fail(`prisma migrate diff failed:\n${r.stderr || r.stdout}`)
  return { same: r.status === 0, sql: r.stdout.trim() }
}

function migrationNames() {
  return readdirSync(MIGRATIONS)
    .filter((n) => statSync(join(MIGRATIONS, n)).isDirectory() && existsSync(join(MIGRATIONS, n, 'migration.sql')))
    .sort()
}

function markApplied(name) {
  log(`marking ${name} as already applied (baseline)`)
  if (prisma(['migrate', 'resolve', '--applied', name]).status !== 0) fail(`prisma migrate resolve --applied ${name} failed`)
}

async function inspect() {
  const db = new PrismaClient()
  try {
    const rows = await db.$queryRawUnsafe(
      `SELECT table_name::text AS name FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'`
    )
    const names = rows.map((r) => r.name)
    const hasHistoryTable = names.includes('_prisma_migrations')
    let historyRows = 0
    if (hasHistoryTable) {
      const [{ n }] = await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "_prisma_migrations"`)
      historyRows = n
    }
    return { appTables: names.filter((n) => n !== '_prisma_migrations').length, historyRows }
  } finally {
    await db.$disconnect()
  }
}

async function main() {
  if (!process.env.DATABASE_URL) fail('DATABASE_URL is not set')
  if (!existsSync(join(MIGRATIONS, BASELINE, 'migration.sql'))) fail(`missing prisma/migrations/${BASELINE}`)

  // Retry the first connection briefly: the private network / database can lag container start.
  let state
  for (let attempt = 1; ; attempt++) {
    try {
      state = await inspect()
      break
    } catch (e) {
      if (attempt >= 5) throw e
      log(`database not reachable yet (attempt ${attempt}/5), retrying in 3 s`)
      await new Promise((r) => setTimeout(r, 3000))
    }
  }
  const { appTables, historyRows } = state

  if (appTables > 0 && historyRows === 0) {
    log(`database has ${appTables} table(s) but no migration history (created by prisma db push) — baselining`)
    const all = migrationNames()

    const current = diffLiveAgainst(SCHEMA)
    if (current.same) {
      log('live schema matches prisma/schema.prisma exactly')
      for (const name of all) markApplied(name)
    } else {
      const base = existsSync(BASELINE_SCHEMA) ? diffLiveAgainst(BASELINE_SCHEMA) : { same: false, sql: '(prisma/baseline missing)' }
      if (base.same) {
        log(`live schema matches ${BASELINE} exactly`)
        markApplied(BASELINE)
      } else {
        const banner = '='.repeat(72)
        console.error(
          `\n${banner}\n[migrate] SCHEMA DRIFT: the live database matches neither ${BASELINE} nor prisma/schema.prisma.\n` +
            `[migrate] SQL that would turn the live database into ${BASELINE}:\n\n${base.sql}\n\n` +
            `[migrate] SQL that would turn it into the current prisma/schema.prisma:\n\n${current.sql}\n${banner}\n`
        )
        if (process.env.MIGRATE_BASELINE_ALLOW_DRIFT !== '1') {
          fail(
            'refusing to baseline a drifted database (nothing was changed). Fix the drift, or set ' +
              'MIGRATE_BASELINE_ALLOW_DRIFT=1 for one deploy to mark 0_init as applied anyway. See README "Database migrations".'
          )
        }
        log('MIGRATE_BASELINE_ALLOW_DRIFT=1 — baselining despite the drift above')
        markApplied(BASELINE)
      }
    }
  } else if (appTables === 0 && historyRows === 0) {
    log('empty database — applying all migrations')
  }

  if (prisma(['migrate', 'deploy']).status !== 0) fail('prisma migrate deploy failed — not starting the app')

  // Safety net for "changed schema.prisma but forgot `prisma migrate dev`": warn (don't
  // block — a hand-added index in production would otherwise stop every deploy).
  const after = diffLiveAgainst(SCHEMA)
  if (!after.same) {
    console.warn(
      '[migrate] WARNING: after applying all migrations the database still differs from prisma/schema.prisma.\n' +
        '[migrate] A schema change is probably missing its migration (run `npx prisma migrate dev`). Difference:\n\n' +
        after.sql + '\n'
    )
  }
  log('database schema is up to date')
}

main().catch((e) => fail(e instanceof Error ? e.message.trim().replace(/^Invalid `prisma\.\$queryRawUnsafe\(\)` invocation:\s*/, '') : e))
