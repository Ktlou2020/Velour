# Restoring a database backup

`ops/backup/backup.mjs` uploads a nightly `pg_dump` in **custom format** (`-Fc`, already compressed) to
`<bucket>/backups/unbound-YYYY-MM-DDTHH-mm.dump` (UTC). Restore it with `pg_restore` (version 18 or
newer — the same `postgresql-client-18` the backup service uses).

Media files are not in the dump: they live on the web service's volume (`UPLOAD_DIR`) or the media
bucket, and should be restored from the same point in time.

## 1. Download the dump

Any S3 client works with the bucket credentials (`BACKUP_S3_*`). With the AWS CLI:

```bash
export AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… AWS_DEFAULT_REGION=auto
aws s3 ls  s3://$BUCKET/backups/ --endpoint-url $BACKUP_S3_ENDPOINT
aws s3 cp  s3://$BUCKET/backups/unbound-2026-10-15T01-00.dump ./restore.dump --endpoint-url $BACKUP_S3_ENDPOINT
pg_restore --list restore.dump | head      # sanity check: prints the archive's table of contents
```

(Railway Buckets: the Credentials tab of the bucket shows the endpoint and keys. Cloudflare R2: the
endpoint is `https://<account-id>.r2.cloudflarestorage.com`.)

## 2a. Restore into a NEW database (recommended)

Restore next to production first, check it, then switch over. On Railway: add a new PostgreSQL service
(same major version or newer), copy its public `DATABASE_URL`, then:

```bash
pg_restore --no-owner --no-acl --exit-on-error --jobs 4 \
  --dbname "$NEW_DATABASE_URL" restore.dump
psql "$NEW_DATABASE_URL" -c 'select count(*) from "User"; select migration_name from _prisma_migrations;'
```

To switch the app over, change the web service's `DATABASE_URL` variable to reference the new database
(and the backup/cron services' too) and redeploy. `scripts/migrate.mjs` then applies any migrations that
are newer than the backup.

## 2b. Restore over the existing database (destructive)

Stop traffic first (e.g. remove the web service's domain or scale it to 0) so nothing writes while
restoring. Empty the schema completely, then restore into it — this also removes tables that later
migrations created, so the schema and the restored `_prisma_migrations` history agree again and the
next deploy's `scripts/migrate.mjs` simply re-applies the newer migrations:

```bash
psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
pg_restore --no-owner --no-acl --exit-on-error --single-transaction \
  --dbname "$DATABASE_URL" restore.dump
```

(Avoid `pg_restore --clean` here: it only drops objects that are in the dump, so tables added after the
backup would survive and the next `prisma migrate deploy` would fail trying to create them again.)

## Partial restores

Restore one table's rows into a scratch database and copy what you need across (`--table` takes the
exact, case-sensitive table name, no quotes):

```bash
pg_restore --list restore.dump | grep 'TABLE DATA'
pg_restore --no-owner --no-acl --schema-only --dbname "$SCRATCH_URL" restore.dump
pg_restore --no-owner --no-acl --data-only --table=Profile --dbname "$SCRATCH_URL" restore.dump
```

## Test restores

Restore the latest dump into a throwaway database every few months (2a without the switch-over) — a
backup that was never restored is not known to work.
