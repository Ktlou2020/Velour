# Hush — Where Connections Become Extraordinary

A world-class premium lifestyle and dating platform built with Next.js 15, TypeScript, Tailwind CSS, and Prisma.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v3 — dark luxury design with crimson (#DC143C) and gold (#D4AF37)
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth v5
- **Fonts**: Playfair Display + Inter

## Getting Started

```bash
npm install
cp .env.example .env.local
# Fill in your DATABASE_URL and NEXTAUTH_SECRET
npx prisma migrate dev
npm run dev
```

## Pages
| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/members` | Browse members |
| `/members/[username]` | Member profile |
| `/discover` | Swipe to discover |
| `/messages` | Messaging inbox |
| `/events` | Community events |
| `/forums` | Community forums |
| `/profile` | My profile |
| `/auth/signup` | Multi-step signup |
| `/auth/signin` | Sign in |
| `/upgrade` | Premium membership |
| `/safety` | Safety centre: meeting tips, SA emergency numbers, "Share my date" |

## Scheduled jobs (cron)

Event RSVP reminders are sent by `GET /api/cron/event-reminders` (POST also works). Each run finds
members marked **GOING** to an event that starts in the next 24 hours who haven't been reminded yet, and
sends a push notification, an email and an in-app notification (`EVENT_REMINDER`). Each attendee is
reminded once (`EventAttendee.reminderSentAt`), so running it more often is safe.

1. Set `CRON_SECRET` to a long random value (`openssl rand -hex 32`). The endpoint refuses every request
   while it is unset.
2. Call the endpoint **hourly** with the secret as a bearer token:

   ```bash
   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/event-reminders
   ```

   - **Railway:** add a second service to the project (e.g. a tiny `curlimages/curl` image or this repo
     with a custom start command) whose start command is the `curl` line above, set its **Cron Schedule**
     to `0 * * * *`, and give it the same `CRON_SECRET` variable. Railway starts it on schedule and it
     exits when done.
   - **Anything else:** cron-job.org, GitHub Actions `schedule:`, or a server crontab can hit the same URL
     with the `Authorization` header.

## Security

- **Sessions** are JWTs. Every `AUTH_REFRESH_SECONDS` (default 300) the token re-reads `role`, `isActive` and
  `username` from the database, so bans, demotions, account deletion and password resets end or update existing
  sessions within that window. `middleware.ts` runs on the Node.js runtime so it can do this check too.
  Admin pages and `/api/admin/*` additionally verify the role in the database on every request (`requireAdmin()`).
- **Rate limiting** (`lib/rate-limit.ts`) covers sign-in (per email and per IP), registration, forgot/reset
  password, verification emails, reports, uploads and account deletion. It is **in-memory and per instance**:
  fine for a single replica, but it resets on restart and isn't shared — move it to Redis before scaling out.
  Client IPs come from the first `X-Forwarded-For` entry (set by Railway's proxy).
- **Passwords**: 8–128 characters with at least one letter and one number, not equal to the email/username;
  bcrypt cost 12. Password-reset and email-verification tokens are random 256-bit values, stored only as
  SHA-256 hashes, single-use and time-limited (1 h / 24 h). Forgot-password always returns the same response.
- **Admins** are granted on each deploy by `scripts/seed-admin.mjs` from `ADMIN_EMAILS` (comma-separated).
- **Headers** (`next.config.js`): CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`. When adding a new external image/font/API host, add it to the CSP or it will be blocked.
# Hush — built 2026-06-03T16:54:21Z
