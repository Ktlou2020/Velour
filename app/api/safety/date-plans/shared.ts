import { escapeHtml } from '@/lib/email'

export const TZ = 'Africa/Johannesburg'
export const MAX_AHEAD_MS = 60 * 24 * 60 * 60 * 1000
export const DAILY_LIMIT = 5

export const planSelect = {
  id: true,
  matchName: true,
  matchUsername: true,
  location: true,
  dateTime: true,
  friendName: true,
  friendEmail: true,
  notes: true,
  checkedInAt: true,
  createdAt: true,
} as const

export function formatWhen(d: Date): string {
  return `${d.toLocaleString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ,
  })} (SAST)`
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/
const USERNAME_RE = /^[A-Za-z0-9_.-]{2,30}$/

export interface DatePlanInput {
  matchName: string
  matchUsername: string | null
  location: string
  dateTime: Date
  friendName: string
  friendEmail: string
  notes: string | null
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export function validateDatePlan(body: unknown): { data: DatePlanInput } | { error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const matchName = str(b.matchName)
  const matchUsername = str(b.matchUsername).replace(/^@/, '')
  const location = str(b.location)
  const friendName = str(b.friendName)
  const friendEmail = str(b.friendEmail).toLowerCase()
  const notes = str(b.notes)
  const dateRaw = str(b.dateTime)

  if (!matchName || matchName.length > 80) return { error: 'Please enter who you are meeting (max 80 characters).' }
  if (matchUsername && !USERNAME_RE.test(matchUsername)) return { error: 'That Hush username doesn’t look right.' }
  if (!location || location.length > 200) return { error: 'Please enter where you are meeting (max 200 characters).' }
  if (!friendName || friendName.length > 80) return { error: 'Please enter your friend’s name (max 80 characters).' }
  if (!friendEmail || friendEmail.length > 254 || !EMAIL_RE.test(friendEmail)) return { error: 'Please enter a valid email address for your friend.' }
  if (notes.length > 1000) return { error: 'Notes must be 1000 characters or fewer.' }

  const dateTime = new Date(dateRaw)
  if (!dateRaw || Number.isNaN(dateTime.getTime())) return { error: 'Please choose a valid date and time.' }
  const now = Date.now()
  if (dateTime.getTime() < now - 5 * 60 * 1000) return { error: 'The date must be in the future.' }
  if (dateTime.getTime() > now + MAX_AHEAD_MS) return { error: 'You can only share dates up to 60 days ahead.' }

  return {
    data: {
      matchName,
      matchUsername: matchUsername || null,
      location,
      dateTime,
      friendName,
      friendEmail,
      notes: notes || null,
    },
  }
}

const p = (html: string) => `<p style="color:#aaaacc; font-size:15px; line-height:1.7; margin:0 0 12px;">${html}</p>`
const row = (label: string, value: string) =>
  `<tr><td style="color:#D4AF37; font-size:13px; padding:6px 12px 6px 0; vertical-align:top; white-space:nowrap;">${label}</td><td style="color:#ffffff; font-size:14px; padding:6px 0; line-height:1.5;">${value}</td></tr>`

export function datePlanEmail(senderName: string, plan: DatePlanInput, appUrl: string): string {
  const e = escapeHtml
  return `
    <h2 style="color:#ffffff; font-family:'Georgia',serif; font-size:22px; margin:0 0 16px;">Hi ${e(plan.friendName)},</h2>
    ${p(`<strong style="color:#ffffff;">${e(senderName)}</strong> is going on a date and has asked Hush to share the details with you, just in case. You don’t need to do anything right now.`)}
    <table cellpadding="0" cellspacing="0" style="margin:16px 0 20px; width:100%; background:#0A0A0F; border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px;">
      ${row('Meeting', e(plan.matchName) + (plan.matchUsername ? ` <span style="color:#888899;">(@${e(plan.matchUsername)} on Hush)</span>` : ''))}
      ${row('Where', e(plan.location))}
      ${row('When', e(formatWhen(plan.dateTime)))}
      ${plan.notes ? row('Notes', e(plan.notes).replace(/\n/g, '<br />')) : ''}
    </table>
    ${p(`We’ll email you again when ${e(senderName)} checks in to say they’re safe. If you haven’t heard from them when you’d expect to, try calling or messaging them directly.`)}
    ${p(`<strong style="color:#ffffff;">If you believe they are in danger, call SAPS on 10111 or 112 from any mobile phone.</strong> The GBV Command Centre is available 24/7 on 0800 428 428.`)}
    <p style="color:#666677; font-size:12px; line-height:1.6; margin:20px 0 0;">You received this because ${e(senderName)} entered your email address in Hush’s “Share my date” feature. We won’t email you for anything else. <a href="${appUrl}/safety" style="color:#DC143C; text-decoration:none;">Hush safety centre</a></p>
  `
}

export function checkInEmail(senderName: string, friendName: string, appUrl: string): string {
  const e = escapeHtml
  return `
    <h2 style="color:#ffffff; font-family:'Georgia',serif; font-size:22px; margin:0 0 16px;">Good news, ${e(friendName)}</h2>
    ${p(`<strong style="color:#ffffff;">${e(senderName)}</strong> has checked in on Hush to let you know they’re safe. Thanks for looking out for them.`)}
    <p style="color:#666677; font-size:12px; line-height:1.6; margin:20px 0 0;"><a href="${appUrl}/safety" style="color:#DC143C; text-decoration:none;">Hush safety centre</a></p>
  `
}
