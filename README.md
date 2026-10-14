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

Reviews housekeeping runs from `GET /api/cron/reviews` (same secret, POST also works; hourly or daily):
expires review requests older than 30 days, publishes double-blind reviews after 14 days (notifying the
reviewee) and re-syncs every member's review score. Expiry and publishing also happen lazily whenever
reviews are read, so a missed run only delays notifications.

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/reviews
```

## Media storage

Photos, chat images and Platinum profile videos are stored **by Hush itself on disk** and served through
`GET /api/media/<id>` (`?size=thumb` for the 480px thumbnail), which checks on every request who may see the
file. Nothing is publicly reachable by guessing a path.

- **Where:** `UPLOAD_DIR` (default `./.uploads` relative to the server's working directory — which is
  `.next/standalone` in production, i.e. wiped on every deploy). **In production, attach a Railway volume**
  to the web service (e.g. mount path `/data`) and set `UPLOAD_DIR=/data/uploads`. Size it for your photos
  (≈ 300–600 KB per photo incl. thumbnail; videos ≤ 30 MB each). A single volume means a single replica.
- **Processing** (`lib/storage.ts`, sharp): the bytes are sniffed (the client's mime type is ignored), EXIF
  orientation is applied and **all metadata (GPS, camera, timestamps) is stripped**; images are re-encoded to
  WebP, max 2048px, plus a 480px thumbnail. Limits: images 10 MB, videos 30 MB (MP4/MOV/WebM, duration ≤ 30 s
  checked in the browser). iPhone HEIC is converted to JPEG in the browser when it can decode it.
- **Who sees what** (`lib/media-access.ts`): owners and admins always; blocked users (either direction) never;
  public photos → signed-in members; main profile photos → also logged-out visitors (landing page);
  private albums → people the owner shared it with (or approved); loose private photos → only the owner;
  chat images → participants of that conversation; profile video → signed-in members. Anything else is a 404.
- **Albums** (`/gallery`, `/api/albums/**`): owners share a private album with a username (access is immediate,
  the member is notified and can leave); members can request access (owner approves/declines).
- **Legacy:** older Cloudinary URLs keep rendering; set `CLOUDINARY_CLOUD_NAME` so they still validate.
- **Backups:** back up the volume together with the database — rows without files render as broken images.

## Content protection (watermarks, no-save, privacy shield)

No website can block OS screenshots; Hush makes stolen copies pointless and traceable instead.

- **Per-viewer image watermarks** (`lib/watermark.ts`, used by `GET /api/media/<id>`): every image (full and
  `?size=thumb`) served to anyone but its owner gets `@viewer · hush · YYYY-MM-DD` (SAST) tiled diagonally across
  the whole picture at ~13% white with a faint dark outline, plus a solid `HUSH · @viewer` corner mark. Admins
  get their own username too; logged-out visitors (public main photos on the landing page) get a generic `HUSH`
  mark. Owners see the clean original. Text is drawn from embedded glyph outlines (`lib/watermark-glyphs.ts`,
  Inter, OFL) so no server fonts are needed. Responses are `Cache-Control: private, max-age=300`,
  `Vary: Cookie`, with a per-viewer-per-day ETag, sent whole (no ranges).
- **Watermark cache:** rendered copies live in `${UPLOAD_DIR}/.wm-cache/<photoId>/<full|thumb>/<sha256>.webp`,
  swept hourly (files older than 2 days, oldest first above `WM_CACHE_MAX_BYTES`, default 2 GB). Decoded
  originals are kept in memory for re-use across viewers (`WM_DECODE_CACHE_BYTES`, default 96 MB).
  Deleting `.wm-cache` at any time is safe.
- **Videos:** chat videos and the profile video are re-encoded on upload when ffmpeg is installed
  (`nixpacks.toml` adds it): H.264/AAC MP4 with faststart, ≤ 1280 px, ≤ 30 fps, with `hush · @owner` burned in,
  hopping corner every 4 s. Length checks run on the original bytes first. Without ffmpeg (or if encoding fails
  or takes over `TRANSCODE_TIMEOUT_MS`, default 150 s) the original is stored as before. One encode runs at a
  time per instance. Optional `FFMPEG_PATH` / `FFPROBE_PATH`.
- **No-save UI:** `components/ProtectedImage.tsx` / `components/ProtectedVideo.tsx` block the context menu,
  drag, selection and iOS long-press save; videos have no download / playback-rate / cast / picture-in-picture
  controls and fullscreen goes through a wrapper so the on-screen viewer watermark stays on top.
- **Privacy shield** (`components/PrivacyShield.tsx`, mounted in `app/layout.tsx`): blurs every
  `[data-protected]` element while the tab is hidden or the window loses focus (app-switcher previews, most
  capture tools), for 1.5 s after screenshot shortcuts (PrintScreen, ⌘⇧3/4/5, Win+Shift+S, with a reminder
  toast), and hides them when printing.
- **Policy:** Terms §4 and the Safety Centre ("Content protection") prohibit capturing/sharing members' content;
  reports use the reason "Shared my photos/videos outside Hush".

## Screenshot blocking in native apps

Real screenshot blocking needs a native shell. The planned route is to wrap the web app with **Capacitor**
(same Next.js UI in a WebView) and add a small native plugin:

- **Android:** set `WindowManager.LayoutParams.FLAG_SECURE` on the activity window
  (`getWindow().setFlags(FLAG_SECURE, FLAG_SECURE)`). The OS then blocks screenshots and screen recording,
  shows a black frame to casting / screen sharing, and hides the content in the recent-apps switcher. It can be
  toggled per screen (e.g. only on profiles, galleries and chats) through a plugin method.
- **iOS:** screenshots can't be prevented, but recording can be detected and reacted to:
  - observe `UIScreen.capturedDidChangeNotification` and check `UIScreen.main.isCaptured` — while the screen is
    being recorded, mirrored or AirPlayed, hide or blur members' media (e.g. tell the web layer to add the
    `hush-shield` class that PrivacyShield already uses);
  - observe `UIApplication.userDidTakeScreenshotNotification` — it fires just after a screenshot is taken:
    show a warning, and log the event server-side (who, which screen/profile) so repeat offenders can be
    reviewed, and optionally notify the member whose content was on screen;
  - common hardening trick: render sensitive views inside a secure `UITextField` layer
    (`isSecureTextEntry = true`), which iOS omits from screenshots and recordings.
- Keep the server-side per-viewer watermark in the native apps too: it is the part that works everywhere.

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
