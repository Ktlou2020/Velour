/**
 * Membership subscription lifecycle (server only), shared by Paystack and PayFast.
 *
 *  - recordMembershipPayment: idempotent on Payment.reference. Creates/extends
 *    the Subscription row (+1 month / +1 year from max(now, currentPeriodEnd)),
 *    sets Profile.membershipTier, writes the PAYMENT notification admin
 *    analytics reads, emails a receipt. Other open subscriptions the member
 *    still has (e.g. Gold → Platinum) are cancelled at the provider.
 *  - cancelMembership / resumeMembership / manageCardLink: self-service.
 *  - expireDue / sendEndingReminders / sendPastDueReminders: the hourly cron.
 *
 * Members with a paid tier but no Subscription row (paid before this existed,
 * or set by an admin) are never downgraded by anything here.
 */
import { Prisma, type MembershipTier, type Subscription } from '@prisma/client'
import { db } from '@/lib/db'
import { escapeHtml, sendBrandedEmail } from '@/lib/email'
import { sendPushToUser } from '@/lib/push'
import { isSuperAdminEmail } from '@/lib/admin-roles'
import { cancelPayfastSubscription } from '@/lib/payfast'
import { appUrl, paymentProviderLabel } from '@/lib/payments'
import {
  PaystackError, customerSubscriptions, disableSubscription, enableSubscription, membershipPriceCents,
  subscriptionManageLink, type BillingPeriod, type PaidTier,
} from '@/lib/paystack'
import { formatRand } from '@/lib/store/format'
import { SUPPORT_EMAIL } from '@/lib/store/config'

export const GRACE_DAYS = 3
export const REMINDER_DAYS = 3
export const PAST_DUE_REMINDER_HOURS = 48
const DAY_MS = 24 * 60 * 60 * 1000

// REFERRAL: a free week of Gold from invite-a-friend (lib/referrals.ts) — period 'week',
// never renews (CANCELLING + cancelAtPeriodEnd), expired by expireDue like any other row.
export type SubscriptionProvider = 'PAYSTACK' | 'PAYFAST' | 'ADMIN' | 'REFERRAL'
export type SubscriptionStatus = 'ACTIVE' | 'CANCELLING' | 'PAST_DUE' | 'EXPIRED'
export const OPEN_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'CANCELLING', 'PAST_DUE']

/** Lifecycle notices (not 'PAYMENT' — analytics counts every PAYMENT notification as a sale). */
export const MEMBERSHIP_NOTICE_TYPE = 'MEMBERSHIP'

const TIER_LABEL: Record<PaidTier, string> = { GOLD: 'Gold', PLATINUM: 'Platinum' }

export function tierLabel(t: MembershipTier | string): string {
  return t === 'GOLD' || t === 'PLATINUM' ? TIER_LABEL[t] : 'Free'
}

export function periodLabel(p: string): string {
  return p === 'annual' ? 'annual' : p === 'week' ? 'one week' : 'monthly'
}

/** +1 month / +1 year, clamped to the month's last day (31 Jan → 28 Feb). */
export function addPeriod(from: Date, period: BillingPeriod): Date {
  const d = new Date(from.getTime())
  const day = d.getUTCDate()
  if (period === 'annual') d.setUTCFullYear(d.getUTCFullYear() + 1)
  else d.setUTCMonth(d.getUTCMonth() + 1)
  if (d.getUTCDate() !== day) d.setUTCDate(0)
  return d
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Johannesburg' })
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

/** Where billing problems that need a human go. */
function billingAlertEmail(): string {
  return (process.env.BILLING_ALERT_EMAIL ?? '').trim() || (process.env.STORE_ADMIN_EMAIL ?? '').trim() || SUPPORT_EMAIL
}

export async function alertBilling(subject: string, text: string): Promise<void> {
  console.warn(`[billing] ALERT: ${subject}`)
  await sendBrandedEmail(billingAlertEmail(), subject, 'Billing alert', `<p style="color:#d0d0d8;font-size:14px;line-height:1.6;">${escapeHtml(text)}</p>`).catch(() => {})
}

// ─── Member messaging ──────────────────────────────────────────────────────

const P = (html: string) => `<p style="color:#d0d0d8;font-size:14px;line-height:1.6;margin:0 0 12px;">${html}</p>`
const button = (label: string, path = '/subscription') =>
  `<p style="margin:24px 0 0;"><a href="${escapeHtml(appUrl() + path)}" style="display:inline-block;background:#DC143C;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;font-size:14px;">${escapeHtml(label)}</a></p>`
const footer = `<p style="color:#666677;font-size:12px;margin:24px 0 0;">Questions about billing? Email <a href="mailto:${SUPPORT_EMAIL}" style="color:#DC143C;">${SUPPORT_EMAIL}</a>.</p>`

async function member(userId: string) {
  return db.user.findUnique({ where: { id: userId }, select: { email: true, role: true, username: true, profile: { select: { displayName: true, membershipTier: true } } } })
}

function greeting(m: { username: string; profile: { displayName: string | null } | null }): string {
  const name = (m.profile?.displayName ?? '').trim().split(' ')[0] || m.username || 'there'
  return `<p style="color:#ffffff;font-size:16px;margin:0 0 12px;">Hi ${escapeHtml(name)},</p>`
}

/** In-app notice + push + email. Best effort: never throws. */
async function tellMember(userId: string, n: { type?: string; title: string; body: string; data?: Record<string, unknown>; subject: string; heading: string; html: (greet: string) => string }) {
  try {
    const m = await member(userId)
    if (!m) return
    const url = '/subscription'
    const results = await Promise.allSettled([
      db.notification.create({ data: { userId, type: n.type ?? MEMBERSHIP_NOTICE_TYPE, title: n.title, body: n.body, data: { url, ...(n.data ?? {}) } as Prisma.InputJsonValue } }),
      sendPushToUser(userId, { title: n.title, body: n.body, url, tag: 'membership' }),
      sendBrandedEmail(m.email, n.subject, n.heading, n.html(greeting(m))),
    ])
    for (const r of results) if (r.status === 'rejected') console.error('[billing] notify failed:', r.reason instanceof Error ? r.reason.message : r.reason)
  } catch (e) {
    console.error('[billing] notify error:', e instanceof Error ? e.message : e)
  }
}

// ─── Payments ──────────────────────────────────────────────────────────────

export interface MembershipPaymentInput {
  userId: string
  provider: 'PAYSTACK' | 'PAYFAST'
  /** Unique per charge: Paystack transaction reference, or "PF-<pf_payment_id>". */
  reference: string
  amountCents: number
  currency: string
  tier: PaidTier
  period: BillingPeriod
  paidAt?: Date
  /** True for the first charge of a checkout we started (Paystack metadata kind 'membership'). */
  newCheckout?: boolean
  paystack?: { customerCode?: string | null; planCode?: string | null; subscriptionCode?: string | null; emailToken?: string | null }
  payfast?: { token?: string | null }
  raw?: Prisma.InputJsonValue
  /** Extra fields for the PAYMENT notification (e.g. pfPaymentId, itemName). */
  notificationData?: Record<string, unknown>
}

export type RecordOutcome = { outcome: 'recorded' | 'duplicate' | 'unwanted'; subscriptionId: string | null }

type SubRow = Subscription

/** The row this payment belongs to, or null for a new subscription. */
async function findRowFor(tx: Prisma.TransactionClient, i: MembershipPaymentInput): Promise<SubRow | null> {
  if (i.provider === 'PAYFAST') {
    if (i.payfast?.token) {
      const byToken = await tx.subscription.findUnique({ where: { payfastToken: i.payfast.token } })
      if (byToken) return byToken.userId === i.userId ? byToken : null
    }
    return tx.subscription.findFirst({
      where: { userId: i.userId, provider: 'PAYFAST', status: { in: OPEN_STATUSES }, payfastToken: i.payfast?.token ? null : undefined },
      orderBy: { createdAt: 'desc' },
    })
  }
  const ps = i.paystack ?? {}
  if (i.newCheckout && ps.planCode) return null // a fresh subscription — older rows get superseded
  if (ps.subscriptionCode) {
    const byCode = await tx.subscription.findUnique({ where: { providerSubscriptionCode: ps.subscriptionCode } })
    if (byCode && byCode.userId === i.userId) return byCode
  }
  if (ps.planCode && ps.customerCode) {
    // Renewals: same customer + plan (any status — a late renewal revives an expired row).
    return tx.subscription.findFirst({
      where: { userId: i.userId, provider: 'PAYSTACK', providerCustomerCode: ps.customerCode, providerPlanCode: ps.planCode },
      orderBy: { createdAt: 'desc' },
    })
  }
  if (!ps.planCode) {
    // One-off period charge: extend the member's open one-off row for the same plan.
    return tx.subscription.findFirst({
      where: { userId: i.userId, provider: 'PAYSTACK', providerPlanCode: null, tier: i.tier, period: i.period, status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: 'desc' },
    })
  }
  return null
}

/**
 * Record a confirmed membership payment and activate/extend the membership.
 * The caller has already verified the payment with the provider and checked
 * the amount. Safe to call any number of times for the same reference.
 */
export async function recordMembershipPayment(i: MembershipPaymentInput): Promise<RecordOutcome> {
  const existing = await db.payment.findUnique({ where: { reference: i.reference }, select: { subscriptionId: true } })
  if (existing) return { outcome: 'duplicate', subscriptionId: existing.subscriptionId }

  const now = new Date()
  const paidAt = i.paidAt && !Number.isNaN(i.paidAt.getTime()) ? i.paidAt : now
  const oneOff = i.provider === 'PAYSTACK' && !i.paystack?.planCode

  let result: { row: SubRow; isNew: boolean; wasExpired: boolean; unwanted: boolean }
  try {
    result = await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          userId: i.userId, provider: i.provider, reference: i.reference, kind: 'MEMBERSHIP',
          amountCents: i.amountCents, currency: i.currency, status: 'SUCCESS', tier: i.tier, period: i.period,
          ...(i.raw !== undefined ? { raw: i.raw } : {}),
        },
      })
      const row = await findRowFor(tx, i)
      if (row && row.status === 'EXPIRED' && row.cancelAtPeriodEnd) {
        // A renewal on a subscription that was cancelled or replaced: keep the
        // record, change nothing else — a human refunds it.
        await tx.payment.update({ where: { id: payment.id }, data: { subscriptionId: row.id } })
        return { row, isNew: false, wasExpired: true, unwanted: true }
      }
      const codes = {
        ...(i.paystack?.customerCode ? { providerCustomerCode: i.paystack.customerCode } : {}),
        ...(i.paystack?.planCode ? { providerPlanCode: i.paystack.planCode } : {}),
        ...(i.paystack?.subscriptionCode ? { providerSubscriptionCode: i.paystack.subscriptionCode } : {}),
        ...(i.paystack?.emailToken ? { emailToken: i.paystack.emailToken } : {}),
        ...(i.payfast?.token ? { payfastToken: i.payfast.token } : {}),
      }
      let saved: SubRow
      if (row) {
        const base = row.currentPeriodEnd.getTime() > now.getTime() ? row.currentPeriodEnd : now
        const stillCancelling = row.status === 'CANCELLING' && row.currentPeriodEnd.getTime() > now.getTime()
        saved = await tx.subscription.update({
          where: { id: row.id },
          data: {
            ...codes,
            tier: i.tier,
            period: i.period,
            status: stillCancelling || oneOff ? 'CANCELLING' : 'ACTIVE',
            cancelAtPeriodEnd: stillCancelling || oneOff,
            ...(stillCancelling ? {} : { cancelledAt: null }),
            currentPeriodEnd: addPeriod(base, i.period),
            lastPaymentAt: paidAt,
            lastPaymentCents: i.amountCents,
            pastDueSince: null,
            pastDueReminderAt: null,
          },
        })
      } else {
        saved = await tx.subscription.create({
          data: {
            ...codes,
            userId: i.userId,
            provider: i.provider,
            tier: i.tier,
            period: i.period,
            status: oneOff ? 'CANCELLING' : 'ACTIVE',
            cancelAtPeriodEnd: oneOff,
            currentPeriodEnd: addPeriod(now, i.period),
            lastPaymentAt: paidAt,
            lastPaymentCents: i.amountCents,
          },
        })
      }
      await tx.payment.update({ where: { id: payment.id }, data: { subscriptionId: saved.id } })
      await tx.profile.updateMany({ where: { userId: i.userId }, data: { membershipTier: i.tier } })
      return { row: saved, isNew: !row, wasExpired: row?.status === 'EXPIRED', unwanted: false }
    })
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Concurrent delivery of the same payment (or a token/code already on another row).
      const again = await db.payment.findUnique({ where: { reference: i.reference }, select: { subscriptionId: true } })
      if (again) return { outcome: 'duplicate', subscriptionId: again.subscriptionId }
    }
    throw e
  }

  const { row, isNew, wasExpired, unwanted } = result
  if (unwanted) {
    await alertBilling('Refund a charge on a cancelled membership', `${paymentProviderLabel(i.provider)} charged ${formatRand(i.amountCents)} (reference ${i.reference}) on member ${i.userId}'s ${i.tier} ${i.period} subscription, which had already been cancelled or replaced (row ${row.id}). Their membership was not changed. Refund it in the ${paymentProviderLabel(i.provider)} dashboard and make sure the subscription is cancelled there.`)
    return { outcome: 'unwanted', subscriptionId: row.id }
  }
  await supersedeOtherSubscriptions(i.userId, row.id)

  const first = isNew || wasExpired
  const tier = TIER_LABEL[i.tier]
  const amount = formatRand(i.amountCents)
  const until = formatDate(row.currentPeriodEnd)
  const renews = !row.cancelAtPeriodEnd
  await tellMember(i.userId, {
    type: 'PAYMENT',
    title: first ? 'Membership Activated' : 'Membership renewed',
    body: first
      ? `Your ${i.tier} membership is now active. Enjoy all the benefits!`
      : `Thanks — your ${tier} membership is paid up until ${until}.`,
    // amountCents/tier/itemName: read by admin analytics (membership revenue).
    data: { tier: i.tier, period: i.period, itemName: `Unbound ${tier}${i.period === 'annual' ? ' (annual)' : ''}`, amountCents: i.amountCents, provider: i.provider, reference: i.reference, ...(i.notificationData ?? {}) },
    subject: first ? `Your Unbound ${tier} receipt` : `Unbound ${tier} renewed — receipt`,
    heading: 'Payment receipt',
    html: (greet) => `${greet}
      ${P(first
        ? `Welcome to <strong>Unbound ${tier}</strong> — your membership is active now.`
        : `Thanks — we’ve received your renewal for <strong>Unbound ${tier}</strong>.`)}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-top:1px solid rgba(255,255,255,0.08);">
        <tr><td style="padding:8px 0;color:#888899;font-size:13px;">Plan</td><td style="padding:8px 0;color:#d0d0d8;font-size:13px;text-align:right;">Unbound ${tier} (${periodLabel(i.period)})</td></tr>
        <tr><td style="padding:8px 0;color:#888899;font-size:13px;">Date</td><td style="padding:8px 0;color:#d0d0d8;font-size:13px;text-align:right;">${escapeHtml(formatDate(paidAt))}</td></tr>
        <tr><td style="padding:8px 0;color:#888899;font-size:13px;">Reference</td><td style="padding:8px 0;color:#d0d0d8;font-size:13px;text-align:right;">${escapeHtml(i.reference)}</td></tr>
        <tr><td style="padding:8px 0;color:#888899;font-size:13px;">Paid via</td><td style="padding:8px 0;color:#d0d0d8;font-size:13px;text-align:right;">${paymentProviderLabel(i.provider)}</td></tr>
        <tr><td style="padding:8px 0;color:#ffffff;font-size:15px;font-weight:bold;">Total (incl. VAT)</td><td style="padding:8px 0;color:#ffffff;font-size:15px;font-weight:bold;text-align:right;">${escapeHtml(amount)}</td></tr>
      </table>
      ${P(renews
        ? `Your membership renews automatically on <strong>${escapeHtml(until)}</strong>. You can cancel any time from your Subscription page — you keep your features until the end of the period you’ve paid for.`
        : `Your membership is paid up until <strong>${escapeHtml(until)}</strong> and won’t renew automatically.`)}
      ${button('Manage subscription')}${footer}`,
  })
  return { outcome: 'recorded', subscriptionId: row.id }
}

/** Record a confirmed store payment (idempotent on reference). */
export async function recordStorePayment(p: { userId: string; provider: 'PAYSTACK' | 'PAYFAST'; reference: string; amountCents: number; currency: string; orderId: string; raw?: Prisma.InputJsonValue }): Promise<void> {
  try {
    await db.payment.create({
      data: { userId: p.userId, provider: p.provider, reference: p.reference, kind: 'STORE', amountCents: p.amountCents, currency: p.currency, status: 'SUCCESS', orderId: p.orderId, ...(p.raw !== undefined ? { raw: p.raw } : {}) },
    })
  } catch (e) {
    if (!isUniqueViolation(e)) throw e
  }
}

/** Stop billing on any other open subscription the member has (they just paid for a new one). */
async function supersedeOtherSubscriptions(userId: string, keepId: string): Promise<void> {
  const others = await db.subscription.findMany({ where: { userId, id: { not: keepId }, status: { in: OPEN_STATUSES } } })
  for (const o of others) {
    const stopped = o.cancelAtPeriodEnd ? true : await stopAtProvider(o)
    await db.subscription.updateMany({
      where: { id: o.id, status: { in: OPEN_STATUSES } },
      data: { status: 'EXPIRED', cancelAtPeriodEnd: true, cancelledAt: o.cancelledAt ?? new Date() },
    })
    if (!stopped) {
      await alertBilling('Cancel a superseded membership', `Member ${userId} started a new membership, but their previous ${paymentProviderLabel(o.provider)} subscription (${o.tier} ${o.period}, row ${o.id}) couldn't be cancelled automatically. Cancel it in the ${paymentProviderLabel(o.provider)} dashboard so they aren't charged twice.`)
    }
  }
}

/** Fill a Paystack row's missing subscription code / email token from the customer's subscriptions. */
async function ensurePaystackCodes(row: SubRow): Promise<SubRow> {
  if (row.provider !== 'PAYSTACK' || (row.providerSubscriptionCode && row.emailToken) || !row.providerCustomerCode || !row.providerPlanCode) return row
  try {
    const subs = await customerSubscriptions(row.providerCustomerCode)
    const match = subs
      .filter((s) => s.plan?.plan_code === row.providerPlanCode && s.subscription_code && (!row.providerSubscriptionCode || s.subscription_code === row.providerSubscriptionCode))
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))[0]
    if (!match) return row
    const taken = await db.subscription.findUnique({ where: { providerSubscriptionCode: match.subscription_code }, select: { id: true } })
    if (taken && taken.id !== row.id) return row
    return await db.subscription.update({
      where: { id: row.id },
      data: { providerSubscriptionCode: match.subscription_code, ...(match.email_token ? { emailToken: match.email_token } : {}) },
    })
  } catch (e) {
    console.warn('[billing] couldn’t look up Paystack subscription codes:', e instanceof Error ? e.message : e)
    return row
  }
}

export async function fillPaystackCodes(subscriptionId: string): Promise<void> {
  const row = await db.subscription.findUnique({ where: { id: subscriptionId } })
  if (row) await ensurePaystackCodes(row)
}

/** Stop future charges at the provider. True = stopped (or nothing to stop); false = needs a human. */
async function stopAtProvider(row: SubRow): Promise<boolean> {
  if (row.provider === 'ADMIN') return true
  if (row.provider === 'PAYSTACK') {
    if (!row.providerPlanCode) return true // one-off charge, nothing recurring
    const r = await ensurePaystackCodes(row)
    if (!r.providerSubscriptionCode || !r.emailToken) return false
    try {
      await disableSubscription(r.providerSubscriptionCode, r.emailToken)
      return true
    } catch (e) {
      if (e instanceof PaystackError && /already|not active|inactive|cancel/i.test(e.message)) return true
      console.warn('[billing] Paystack disable failed:', e instanceof Error ? e.message : e)
      return false
    }
  }
  if (row.provider === 'PAYFAST') {
    if (!row.payfastToken) return false
    return (await cancelPayfastSubscription(row.payfastToken)) === 'cancelled'
  }
  return false
}

// ─── Self-service ──────────────────────────────────────────────────────────

/** The member's current (non-expired) subscription, if any. */
export async function currentSubscription(userId: string): Promise<SubRow | null> {
  return db.subscription.findFirst({ where: { userId, status: { in: OPEN_STATUSES } }, orderBy: [{ currentPeriodEnd: 'desc' }] })
}

export function canResume(row: SubRow, now = new Date()): boolean {
  return row.provider === 'PAYSTACK' && row.cancelAtPeriodEnd && !!row.providerPlanCode
    && row.status === 'CANCELLING' && row.currentPeriodEnd.getTime() > now.getTime()
}

export function canManageCard(row: SubRow): boolean {
  return row.provider === 'PAYSTACK' && !!row.providerPlanCode && row.status !== 'EXPIRED' && !!(row.providerSubscriptionCode || row.providerCustomerCode)
}

export type ActionResult = { ok: true; message: string } | { ok: false; status: number; error: string }

export async function cancelMembership(userId: string): Promise<ActionResult> {
  const row = await currentSubscription(userId)
  if (!row) return { ok: false, status: 404, error: 'You don’t have a membership that renews.' }
  const until = formatDate(row.currentPeriodEnd)
  if (row.cancelAtPeriodEnd) return { ok: true, message: `Your membership already ends on ${until}.` }

  const stopped = await stopAtProvider(row)
  const claimed = await db.subscription.updateMany({
    where: { id: row.id, cancelAtPeriodEnd: false, status: { in: OPEN_STATUSES } },
    data: { status: row.status === 'PAST_DUE' ? 'PAST_DUE' : 'CANCELLING', cancelAtPeriodEnd: true, cancelledAt: new Date() },
  })
  if (claimed.count !== 1) return { ok: true, message: `Your membership ends on ${until}.` }
  if (!stopped) {
    await alertBilling('Membership cancellation needs a manual step', `Member ${userId} cancelled their ${row.tier} ${row.period} membership on the site, but the ${paymentProviderLabel(row.provider)} subscription (row ${row.id}) couldn't be stopped automatically. Cancel it in the ${paymentProviderLabel(row.provider)} dashboard before ${until} so they aren't charged again.`)
  }
  const tier = tierLabel(row.tier)
  await tellMember(userId, {
    title: 'Membership cancelled',
    body: `Your ${tier} membership won’t renew. You keep your features until ${until}.`,
    subject: `Your Unbound ${tier} membership won’t renew`,
    heading: 'Membership cancelled',
    html: (greet) => `${greet}
      ${P(`We’ve cancelled your <strong>Unbound ${tier}</strong> renewal — you won’t be charged again.`)}
      ${P(`You keep all your ${tier} features until <strong>${escapeHtml(until)}</strong>. After that your account moves to the Free plan; your profile, matches and messages stay as they are.`)}
      ${P(canResume({ ...row, cancelAtPeriodEnd: true, status: 'CANCELLING' }) ? 'Changed your mind? You can resume from your Subscription page any time before then.' : 'Changed your mind? You can upgrade again any time.')}
      ${button('View subscription')}${footer}`,
  })
  return { ok: true, message: stopped
    ? `Done — your membership won’t renew. You keep your features until ${until}.`
    : `Your membership won’t renew — you keep your features until ${until}. Our team will make sure no further payments are taken.` }
}

export async function resumeMembership(userId: string): Promise<ActionResult> {
  const row0 = await currentSubscription(userId)
  if (!row0 || !canResume(row0)) return { ok: false, status: 409, error: 'This membership can’t be resumed — you can upgrade again from the plans page.' }
  const row = await ensurePaystackCodes(row0)
  if (!row.providerSubscriptionCode || !row.emailToken) return { ok: false, status: 409, error: 'This membership can’t be resumed — you can upgrade again from the plans page.' }
  try {
    await enableSubscription(row.providerSubscriptionCode, row.emailToken)
  } catch (e) {
    console.warn('[billing] Paystack enable failed:', e instanceof Error ? e.message : e)
    return { ok: false, status: 502, error: 'We couldn’t resume your membership right now — please try again in a few minutes.' }
  }
  await db.subscription.update({ where: { id: row.id }, data: { status: 'ACTIVE', cancelAtPeriodEnd: false, cancelledAt: null } })
  const until = formatDate(row.currentPeriodEnd)
  await tellMember(userId, {
    title: 'Membership resumed',
    body: `Welcome back — your ${tierLabel(row.tier)} membership renews on ${until}.`,
    subject: `Your Unbound ${tierLabel(row.tier)} membership is back on`,
    heading: 'Membership resumed',
    html: (greet) => `${greet}${P(`Your <strong>Unbound ${tierLabel(row.tier)}</strong> membership will renew as usual on <strong>${escapeHtml(until)}</strong>.`)}${button('View subscription')}${footer}`,
  })
  return { ok: true, message: `Your membership is back on — it renews on ${until}.` }
}

/** Paystack's hosted "update card" page for the member's subscription. */
export async function manageCardLink(userId: string): Promise<ActionResult & { url?: string }> {
  const row0 = await currentSubscription(userId)
  if (!row0 || !canManageCard(row0)) return { ok: false, status: 404, error: 'There’s no card on file to update.' }
  const row = await ensurePaystackCodes(row0)
  if (!row.providerSubscriptionCode) return { ok: false, status: 409, error: 'Your card details aren’t available yet — please try again in a few minutes.' }
  try {
    const url = await subscriptionManageLink(row.providerSubscriptionCode)
    if (!/^https:\/\//.test(url)) throw new Error('unexpected link')
    return { ok: true, message: 'ok', url }
  } catch (e) {
    console.warn('[billing] Paystack manage link failed:', e instanceof Error ? e.message : e)
    return { ok: false, status: 502, error: 'We couldn’t open the card page right now — please try again.' }
  }
}

// ─── Provider events ───────────────────────────────────────────────────────

/** Provider says the subscription won't renew (member cancelled elsewhere / provider disabled it). */
export async function markNotRenewing(row: SubRow, source: string): Promise<void> {
  if (row.status === 'EXPIRED' || row.cancelAtPeriodEnd) return
  const claimed = await db.subscription.updateMany({
    where: { id: row.id, cancelAtPeriodEnd: false, status: { in: OPEN_STATUSES } },
    data: { status: row.status === 'PAST_DUE' ? 'PAST_DUE' : 'CANCELLING', cancelAtPeriodEnd: true, cancelledAt: new Date() },
  })
  if (claimed.count !== 1) return
  console.log(`[billing] subscription ${row.id} set to not renew (${source})`)
  const until = formatDate(row.currentPeriodEnd)
  const tier = tierLabel(row.tier)
  await tellMember(row.userId, {
    title: 'Membership won’t renew',
    body: `Your ${tier} membership has been cancelled. You keep your features until ${until}.`,
    subject: `Your Unbound ${tier} membership won’t renew`,
    heading: 'Membership cancelled',
    html: (greet) => `${greet}${P(`Your <strong>Unbound ${tier}</strong> membership has been cancelled and won’t renew. You keep your ${tier} features until <strong>${escapeHtml(until)}</strong>.`)}${P('If you didn’t mean to cancel, you can start a new membership from the plans page any time.')}${button('View subscription')}${footer}`,
  })
}

/** A renewal charge failed. */
export async function markPastDue(row: SubRow): Promise<void> {
  if (row.status !== 'ACTIVE') return
  const now = new Date()
  const claimed = await db.subscription.updateMany({ where: { id: row.id, status: 'ACTIVE' }, data: { status: 'PAST_DUE', pastDueSince: now, pastDueReminderAt: now } })
  if (claimed.count !== 1) return
  await pastDueNotice(row, false)
}

async function pastDueNotice(row: SubRow, reminder: boolean): Promise<void> {
  const tier = tierLabel(row.tier)
  const cutoff = formatDate(new Date(row.currentPeriodEnd.getTime() + GRACE_DAYS * DAY_MS))
  const cardLink = canManageCard(row)
  await tellMember(row.userId, {
    title: reminder ? 'Reminder: payment needed' : 'Payment didn’t go through',
    body: `We couldn’t renew your ${tier} membership. ${cardLink ? 'Update your card' : 'Renew'} before ${cutoff} to keep your features.`,
    subject: reminder ? `Reminder: your Unbound ${tier} payment didn’t go through` : `Your Unbound ${tier} payment didn’t go through`,
    heading: 'Payment problem',
    html: (greet) => `${greet}
      ${P(`We tried to renew your <strong>Unbound ${tier}</strong> membership but the payment didn’t go through.`)}
      ${P(cardLink
        ? `Please update your card from your Subscription page before <strong>${escapeHtml(cutoff)}</strong> — after that your account moves to the Free plan.`
        : `To keep your ${tier} features, renew from the plans page before <strong>${escapeHtml(cutoff)}</strong> — after that your account moves to the Free plan.`)}
      ${button(cardLink ? 'Update card' : 'Renew membership', cardLink ? '/subscription' : '/upgrade')}${footer}`,
  })
}

// ─── Cron ──────────────────────────────────────────────────────────────────

/** Expire subscriptions past currentPeriodEnd + grace and move those members to Free. */
export async function expireDue(now = new Date(), limit = 500): Promise<{ expired: number; downgraded: number }> {
  const cutoff = new Date(now.getTime() - GRACE_DAYS * DAY_MS)
  const due = await db.subscription.findMany({
    where: { status: { in: OPEN_STATUSES }, currentPeriodEnd: { lt: cutoff } },
    orderBy: { currentPeriodEnd: 'asc' },
    take: limit,
  })
  let expired = 0
  let downgraded = 0
  for (const row of due) {
    const claimed = await db.subscription.updateMany({
      where: { id: row.id, status: { in: OPEN_STATUSES }, currentPeriodEnd: { lt: cutoff } },
      data: { status: 'EXPIRED' },
    })
    if (claimed.count !== 1) continue
    expired++

    const m = await member(row.userId)
    if (!m || m.role === 'ADMIN' || isSuperAdminEmail(m.email)) continue
    // Still covered by another subscription → keep their tier.
    const other = await db.subscription.findFirst({ where: { userId: row.userId, id: { not: row.id }, status: { in: OPEN_STATUSES }, currentPeriodEnd: { gte: cutoff } }, select: { id: true } })
    if (other) continue
    // Only undo the tier this subscription gave them (an admin may have changed it since).
    // Founding members keep Platinum forever, even if a paid subscription lapses.
    const down = await db.profile.updateMany({ where: { userId: row.userId, membershipTier: row.tier, foundingMemberNumber: null }, data: { membershipTier: 'FREE' } })
    if (down.count !== 1) continue
    downgraded++
    const tier = tierLabel(row.tier)
    await tellMember(row.userId, {
      title: 'Membership ended',
      body: `Your ${tier} membership has ended and your account is now on the Free plan.`,
      subject: `Your Unbound ${tier} membership has ended`,
      heading: 'Membership ended',
      html: (greet) => `${greet}
        ${P(`Your <strong>Unbound ${tier}</strong> membership has ended, so your account is now on the Free plan.`)}
        ${P('Your profile, matches and messages are all still here. You can upgrade again whenever you like.')}
        ${button('See plans', '/upgrade')}${footer}`,
    })
  }
  return { expired, downgraded }
}

/** "Renews in 3 days" for annual plans; "ends in 3 days" for memberships that won't renew. Once per period. */
export async function sendEndingReminders(now = new Date(), limit = 500): Promise<number> {
  const horizon = new Date(now.getTime() + REMINDER_DAYS * DAY_MS)
  const rows = await db.subscription.findMany({
    where: {
      currentPeriodEnd: { gt: now, lte: horizon },
      OR: [
        { status: 'ACTIVE', period: 'annual', cancelAtPeriodEnd: false },
        { status: 'CANCELLING', cancelAtPeriodEnd: true },
      ],
    },
    take: limit,
  })
  let sent = 0
  for (const row of rows) {
    // A reminder for this period end (or one within a week of it) was already sent.
    const claimed = await db.subscription.updateMany({
      where: { id: row.id, OR: [{ renewalReminderFor: null }, { renewalReminderFor: { lt: new Date(row.currentPeriodEnd.getTime() - 7 * DAY_MS) } }] },
      data: { renewalReminderFor: row.currentPeriodEnd },
    })
    if (claimed.count !== 1) continue
    sent++
    const tier = tierLabel(row.tier)
    const date = formatDate(row.currentPeriodEnd)
    if (row.cancelAtPeriodEnd) {
      const resumable = canResume(row, now)
      await tellMember(row.userId, {
        title: `${tier} ends ${date}`,
        body: `Your ${tier} membership ends on ${date}. ${resumable ? 'Resume any time before then to keep it.' : 'Renew to keep your features.'}`,
        subject: `Your Unbound ${tier} membership ends on ${date}`,
        heading: 'Membership ending',
        html: (greet) => `${greet}${P(`Just a heads-up: your <strong>Unbound ${tier}</strong> membership ends on <strong>${escapeHtml(date)}</strong>, and your account then moves to the Free plan.`)}${P(resumable ? 'Want to keep it? Resume from your Subscription page before then.' : 'Want to keep it? You can renew from the plans page.')}${button(resumable ? 'Resume membership' : 'See plans', resumable ? '/subscription' : '/upgrade')}${footer}`,
      })
    } else {
      const amount = formatRand(row.lastPaymentCents ?? membershipPriceCents(row.tier as PaidTier, 'annual'))
      await tellMember(row.userId, {
        title: `${tier} renews ${date}`,
        body: `Your annual ${tier} membership renews on ${date} (${amount}).`,
        subject: `Your Unbound ${tier} membership renews on ${date}`,
        heading: 'Renewal reminder',
        html: (greet) => `${greet}${P(`Your annual <strong>Unbound ${tier}</strong> membership renews automatically on <strong>${escapeHtml(date)}</strong> for <strong>${escapeHtml(amount)}</strong>.`)}${P('Nothing to do if you’d like to keep it. If not, you can cancel from your Subscription page before then — you’ll keep your features until the end of this year.')}${button('Manage subscription')}${footer}`,
      })
    }
  }
  return sent
}

/** Nudge members whose renewal failed, at most every PAST_DUE_REMINDER_HOURS, until they expire. */
export async function sendPastDueReminders(now = new Date(), limit = 500): Promise<number> {
  const before = new Date(now.getTime() - PAST_DUE_REMINDER_HOURS * 60 * 60 * 1000)
  const rows = await db.subscription.findMany({
    where: {
      status: 'PAST_DUE',
      currentPeriodEnd: { gte: new Date(now.getTime() - GRACE_DAYS * DAY_MS) },
      OR: [{ pastDueReminderAt: null }, { pastDueReminderAt: { lt: before } }],
    },
    take: limit,
  })
  let sent = 0
  for (const row of rows) {
    const claimed = await db.subscription.updateMany({
      where: { id: row.id, status: 'PAST_DUE', OR: [{ pastDueReminderAt: null }, { pastDueReminderAt: { lt: before } }] },
      data: { pastDueReminderAt: now },
    })
    if (claimed.count !== 1) continue
    sent++
    await pastDueNotice(row, true)
  }
  return sent
}

/** Open, still-renewing subscriptions — read before an account is deleted (the rows cascade away). */
export async function renewingSubscriptions(userId: string): Promise<SubRow[]> {
  return db.subscription.findMany({ where: { userId, status: { in: OPEN_STATUSES }, cancelAtPeriodEnd: false } })
}

/** After an account was deleted: stop its subscriptions at the provider (best effort, alerts on failure). */
export async function stopSubscriptionsOfDeletedAccount(rows: SubRow[]): Promise<void> {
  for (const row of rows) {
    const stopped = await stopAtProvider(row).catch(() => false)
    if (!stopped) {
      await alertBilling('Cancel a deleted member’s subscription', `A member deleted their account, but their ${paymentProviderLabel(row.provider)} subscription (${row.tier} ${row.period}, ${row.providerSubscriptionCode ?? row.providerCustomerCode ?? (row.payfastToken ? `token ${row.payfastToken}` : 'no provider id')}) couldn't be cancelled automatically. Cancel it in the ${paymentProviderLabel(row.provider)} dashboard.`)
    }
  }
}
