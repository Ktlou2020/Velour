#!/usr/bin/env bash
# End-to-end tests against a production build (see tests/README.md).
#
#   E2E_DATABASE_URL=postgresql://postgres@localhost:5432/unbound_test npm run test:e2e
#
# WIPES the database in E2E_DATABASE_URL, so it refuses anything that isn't on
# this machine. Needs a build first (npm run build). Pass test files to run
# only those, e.g.  npm run test:e2e -- tests/e2e/gallery.test.mjs
set -euo pipefail
cd "$(dirname "$0")/.."

: "${E2E_DATABASE_URL:?Set E2E_DATABASE_URL to a throwaway local Postgres database}"
case "$E2E_DATABASE_URL" in
  *@localhost[:/]*|*@127.0.0.1[:/]*|*host=/*) ;;
  *) echo "Refusing: E2E_DATABASE_URL must point at a local database (it gets wiped)." >&2; exit 1 ;;
esac
[ -f .next/standalone/server.js ] || { echo "No build found — run npm run build first." >&2; exit 1; }

export DATABASE_URL="$E2E_DATABASE_URL"
PORT="${E2E_PORT:-3999}"
export E2E_BASE_URL="http://localhost:$PORT"
export E2E_SERVER_LOG="${E2E_SERVER_LOG:-$(mktemp -t unbound-e2e-server.XXXXXX)}"
export CRON_SECRET="${CRON_SECRET:-e2e-cron-secret}"
UPLOAD_DIR="$(mktemp -d -t unbound-e2e-uploads.XXXXXX)"
# Throwaway push keys so the phone-alert tests run (never the real ones).
if [ -z "${VAPID_PUBLIC_KEY:-}" ]; then
  KEYS="$(npx --no-install web-push generate-vapid-keys --json)"
  export VAPID_PUBLIC_KEY="$(node -e 'console.log(JSON.parse(process.argv[1]).publicKey)' "$KEYS")"
  export VAPID_PRIVATE_KEY="$(node -e 'console.log(JSON.parse(process.argv[1]).privateKey)' "$KEYS")"
fi

echo "▸ Resetting test database"
printf 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;' | npx prisma db execute --stdin --url "$DATABASE_URL" >/dev/null
node scripts/migrate.mjs | tail -1

echo "▸ Starting server on :$PORT (log: $E2E_SERVER_LOG)"
(
  cd .next/standalone
  PORT="$PORT" HOSTNAME=127.0.0.1 \
  NEXTAUTH_SECRET="e2e-secret-0123456789-0123456789-0123456789" NEXTAUTH_URL="$E2E_BASE_URL" AUTH_TRUST_HOST=true \
  UPLOAD_DIR="$UPLOAD_DIR" CRON_SECRET="$CRON_SECRET" LIFECYCLE_SEND_ANY_HOUR=true \
  SUPER_ADMIN_EMAILS="boss@e2e.test" \
  VAPID_PUBLIC_KEY="${VAPID_PUBLIC_KEY:-}" VAPID_PRIVATE_KEY="${VAPID_PRIVATE_KEY:-}" VAPID_SUBJECT="mailto:e2e@example.com" \
  NODE_TLS_REJECT_UNAUTHORIZED=0 \
  exec node server.js
) > "$E2E_SERVER_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true; rm -rf "$UPLOAD_DIR"' EXIT

for _ in $(seq 1 60); do
  curl -sf "$E2E_BASE_URL/api/health" >/dev/null 2>&1 && break
  kill -0 $SERVER_PID 2>/dev/null || { echo "Server exited:"; tail -40 "$E2E_SERVER_LOG"; exit 1; }
  sleep 1
done
curl -sf "$E2E_BASE_URL/api/health" >/dev/null || { echo "Server didn't start:"; tail -40 "$E2E_SERVER_LOG"; exit 1; }

echo "▸ Running tests"
if [ "$#" -gt 0 ]; then FILES=("$@"); else FILES=(tests/e2e/*.test.mjs); fi
node --test --test-concurrency=1 --test-reporter=spec "${FILES[@]}"
