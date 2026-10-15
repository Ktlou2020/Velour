# Unbound — Where Connections Become Extraordinary

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
| `/store` | Toystory, the adult store (members only): catalogue, cart, checkout, `/store/orders` |
| `/admin/store` | Store admin: products, categories, orders, 30-day sales |

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

View-once chat media is cleaned up by `GET /api/cron/view-once` (same secret, POST also works; hourly):
deletes the stored file of every view-once photo/video that all recipients have opened (once their
viewing window has ended) or that is older than 14 days, and sets `Message.mediaDeletedAt`. The same
clean-up also runs lazily after each opening and whenever a chat is read, so the cron only catches stragglers.

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/view-once
```

Store housekeeping runs from `GET /api/cron/store` (same secret, POST also works; every 10–15 minutes):
cancels unpaid store orders older than 30 minutes and puts their stock back. Store pages also run it
lazily (at most once a minute per instance), so a missed run only delays the release.

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/store
```

## Notifications & push

In-app notifications are `Notification` rows (type, title, body, `data.url` deep link). One helper set
lives in `lib/notifications.ts`; link resolution (with per-type fallbacks) in `lib/notification-links.ts`.

- **Bell (navbar):** unread *activity*: likes, winks, super likes, matches, profile views, couple,
  albums, photo likes, reviews, events, membership and verification. It **excludes `MESSAGE`**, because
  messages have their own badge, and `REPORT`, which is the admin queue in `/admin/reports`. Mobile
  shows a bell link to `/notifications` in the top bar.
- **Messages badges (navbar + mobile tab bar):** unread **messages** (sum of
  `ConversationParticipant.unreadCount`, skipping blocked conversations), not notifications.
- **`/notifications`:** everything except `REPORT`, with All / Activity / Messages tabs, day grouping
  and "Load more". There is one `MESSAGE` row per conversation while it's unread ("Thandi sent you 3
  messages"). Opening the chat marks it read.
- **Live updates:** `GET /api/notifications/stream` (SSE) pushes `counts` and new notifications. If the
  stream is down, clients poll `GET /api/notifications/unread` every 25 s. Badges also refresh on tab
  focus, after anything is marked read, and when a push arrives.

### Web push (optional)

Push is off unless VAPID keys are set. Without them, `sendPushToUser` is a silent no-op,
`GET /api/push` returns `{ enabled: false }` and the "Enable notifications" prompt is never shown.
In-app notifications work either way. To turn push on:

```bash
npx web-push generate-vapid-keys
```

On Railway, open the web service, go to **Variables**, and add:

| Variable | Value |
| --- | --- |
| `VAPID_PUBLIC_KEY` | the generated *Public Key* |
| `VAPID_PRIVATE_KEY` | the generated *Private Key* (secret) |
| `VAPID_SUBJECT` | optional, e.g. `mailto:hello@unbound.dating` (the default) |

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` is also accepted for the public key, but you don't need it: the browser
fetches the key from `GET /api/push` at runtime, so you don't have to rebuild. Redeploy after you set
the keys. Don't change them afterwards: existing browser subscriptions are tied to the key pair, so
members would have to opt in again. `public/sw.js` shows the notification and, on click, focuses or
opens the `url` from the payload (same-origin paths only).

## Media storage

Photos, chat images and Platinum profile videos are stored **by Unbound itself on disk** and served through
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

No website can block OS screenshots; Unbound makes stolen copies pointless and traceable instead.

- **Per-viewer image watermarks** (`lib/watermark.ts`, used by `GET /api/media/<id>`): every image (full and
  `?size=thumb`) served to anyone but its owner gets `@viewer · unbound · YYYY-MM-DD` (SAST) tiled diagonally across
  the whole picture at ~13% white with a faint dark outline, plus a solid `UNBOUND · @viewer` corner mark. Admins
  get their own username too; logged-out visitors (public main photos on the landing page) get a generic `UNBOUND`
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
  reports use the reason "Shared my photos/videos outside Unbound".

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

## Store (Toystory)

The adult store lives at `/store` (login required, so 18+ like the rest of the app). Its name is the single
constant `STORE_NAME` in `lib/store/config.ts` (with `STORE_TAGLINE`) — rename it there and every page,
email, admin label and PayFast item name follows. Order numbers use `ORDER_NUMBER_PREFIX` (`TS-10023`).

- **Catalogue**: `ProductCategory` / `Product` (prices in cents, VAT-inclusive). Search covers name,
  description, tags and category; filters for category, price range and stock; sorts featured / newest / price.
  Descriptions are plain text (tags stripped, rendered as text with line breaks).
- **Photos**: admins upload with `POST /api/upload` `purpose=product` (403 for anyone else). They live in the
  uploader's hidden `__store` album, are visible to every logged-in member and are served **without** the
  per-viewer watermark (they are catalogue images, not members' content). Products without photos show a
  neutral icon tile.
- **Cart**: `localStorage` per member (`hush_store_cart:<userId>`), re-priced by `POST /api/store/cart/quote`.
  The server never trusts client prices.
- **Checkout** (`POST /api/store/checkout`): validates delivery details (SA phone, 4-digit postal code, the 9
  provinces), re-prices from the database, then reserves stock atomically (`UPDATE … WHERE stock >= qty` in a
  transaction, so the last unit can't be sold twice) and creates a `PENDING_PAYMENT` order. Unpaid orders are
  cancelled and restocked after 30 minutes (cron above + lazily). A member has at most one unpaid order —
  checking out again replaces it.
- **Delivery fee**: `STORE_SHIPPING_CENTS` (default R 99), free from `STORE_FREE_SHIPPING_OVER_CENTS`
  (default R 1 000). Parcels default to discreet packaging with sender `STORE_DISCREET_SENDER`.
- **Orders**: members see `/store/orders`; status emails + in-app notifications (`STORE_ORDER`) go out on
  Paid, Shipped (with tracking), Delivered, Cancelled and Refunded. Notification text never names products.
- **Admin** (`/admin/store`): products (photos, reorder, stock, featured/live toggles; stock edits are applied
  as a delta so concurrent checkouts aren't overwritten), categories (order), orders (Processing → Shipped
  with courier + tracking number or link → Delivered; Cancel/Refund put unshipped items back in stock —
  the refund itself is done in the PayFast dashboard), low stock and 30-day sales. "Create sample
  catalogue" seeds 4 categories and 8 text-only sample products tagged `sample`.
- **Legal copy**: `/terms#store-terms` (18+, VAT, SA-only delivery, ECTA cooling-off for sealed items,
  CPA 6-month defective-goods returns, hygiene, POPIA). Have it reviewed before launch, and only show
  "incl. VAT" if the business is VAT-registered.

## Payments (PayFast)

`lib/payfast.ts` is shared by membership upgrades (`POST /api/payment/payfast`) and the store.

| Variable | |
|---|---|
| `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY` | Required. Without them checkout answers 503 "Payments aren't set up yet". |
| `PAYFAST_PASSPHRASE` | Set the same value in PayFast → Settings. Required for subscriptions. |
| `PAYFAST_SANDBOX=true` | Use `sandbox.payfast.co.za` (test merchant 10000100 / 46f0cd694581a / passphrase jt7NOE43FZPn). |
| `PAYFAST_SKIP_VALIDATE=true` | Local tests only — skips the server-to-server ITN check; ignored for live payments in production. |
| `NEXT_PUBLIC_APP_URL` | Must be the public https URL — return, cancel and notify URLs are built from it. |

- **Checkout signature**: non-empty fields in PayFast's documented order (merchant → customer →
  transaction → options → subscription), values trimmed and encoded like PHP `urlencode` (spaces `+`,
  uppercase hex), `&passphrase=…` appended, md5. The browser posts a real `<form>` to `/eng/process`
  (allowed by the CSP `form-action`). Store payments send `m_payment_id` = the order's `paymentRef`,
  `custom_str1=store`, `custom_str2` = order number, and a discreet `item_name` ("Toystory order TS-10023").
- **ITN** `POST /api/payment/payfast/notify`: parses the raw body in received order, verifies the signature
  (400 if wrong), checks `merchant_id`, confirms with PayFast `/eng/query/validate` (503 on network trouble so
  PayFast retries), then routes: `m_payment_id` matching an order → store (amount must equal the order total
  ±R0.01, idempotent on `pf_payment_id`, `COMPLETE` → Paid + email + notification, `FAILED`/`CANCELLED` →
  cancelled + restocked); otherwise membership (`custom_str1` = user id, tier from the item name, amount must
  match a plan price). A payment that arrives just after a reservation lapsed re-reserves the stock if it is
  still there, otherwise the order is flagged for a refund (`STORE_ADMIN_EMAIL` gets an alert).
- Return/cancel URLs: `/store/thank-you?order=…` (polls until the ITN lands) and `/store/checkout?cancelled=1`.

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
# Unbound — built 2026-06-03T16:54:21Z
