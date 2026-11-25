# Tests

End-to-end tests run against a real production build and a throwaway Postgres
database. They cover sign-up, messaging, View once, safety tools, admin
two-step login, the Gallery, lifecycle emails, support tickets, phone alerts,
and a few real-browser flows.

GitHub runs them on every push (`.github/workflows/ci.yml`), and Railway waits
for them to pass before deploying `main`.

## Running locally

You need Postgres (any local database you don't mind being wiped) and a build.

```bash
npm ci
npm run build
E2E_DATABASE_URL=postgresql://postgres@localhost:5432/unbound_test npm run test:e2e
```

- Run a single file: `npm run test:e2e -- tests/e2e/gallery.test.mjs`
- Browser tests use Playwright's Chromium (`npx playwright-core install chromium`),
  or point `E2E_CHROMIUM` at a Chromium binary.
- The runner **wipes** the database in `E2E_DATABASE_URL` and refuses anything
  that isn't on this machine. It starts the server itself on port 3999
  (`E2E_PORT` to change) and generates throwaway push keys.

## Writing tests

Tests are plain `node:test` files in `tests/e2e/*.test.mjs`. `helpers.mjs` has:

- `makeUser(username, { user, profile })`: a member with a finished profile.
- `login(email)`: a signed-in HTTP client (`get`, `post`, `patch`, `del`, `upload`).
- `adminLogin(email)`: signs in and completes admin two-step login.
- `ensureBoss()`: the super admin (`boss@e2e.test`).
- `matchAndChat(a, b)`, `runLifecycle()`, `serverLog()`, `jpeg()`.

Each file uses its own random usernames (`rid()`), so files don't interfere.
