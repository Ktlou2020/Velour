# Nightly database backup (Railway "db-backup" service, root directory /ops/backup).
# pg_dump must be >= the server's major version. The database runs Postgres 18,
# so start from the official postgres:18 image (pg_dump/pg_restore 18) and add Node.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM postgres:18-bookworm
COPY --from=deps /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json backup.mjs ./
# Not a database server: run the backup script directly.
ENTRYPOINT []
CMD ["node", "backup.mjs"]
