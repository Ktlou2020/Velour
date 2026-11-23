/**
 * Admin → System health: is everything that runs quietly in the background
 * actually set up? Checks only whether settings exist (never their values)
 * and looks up the email domain's public DNS records from the server.
 */
import { promises as dns } from 'dns'
import { db } from '@/lib/db'
import { pushEnabled } from '@/lib/push'
import { mfaRequired } from '@/lib/admin-mfa'

export type CheckStatus = 'ok' | 'warn' | 'fail'
export interface HealthCheck { group: string; name: string; status: CheckStatus; detail: string; fix?: string }

async function txt(name: string): Promise<string[] | null> {
  try { return (await dns.resolveTxt(name)).map((r) => r.join('')) } catch { return null }
}
async function cname(name: string): Promise<string[] | null> {
  try { return await dns.resolveCname(name) } catch { return null }
}

export function fromDomain(): string {
  const from = process.env.EMAIL_FROM ?? 'Unbound <noreply@unboundza.com>'
  return (from.match(/@([^>\s]+)/)?.[1] ?? 'unboundza.com').toLowerCase()
}

export async function emailChecks(domain = fromDomain()): Promise<HealthCheck[]> {
  const out: HealthCheck[] = []
  const brevo = !!process.env.BREVO_API_KEY?.trim()
  const smtp = !!process.env.EMAIL_HOST?.trim()
  out.push(brevo || smtp
    ? { group: 'Email', name: 'Email provider', status: 'ok', detail: brevo ? 'Brevo is connected.' : 'SMTP is connected.' }
    : { group: 'Email', name: 'Email provider', status: 'fail', detail: 'No email provider is set, so no emails are sent.', fix: 'Add BREVO_API_KEY in Railway → Variables.' })

  const spf = (await txt(domain))?.find((r) => r.toLowerCase().startsWith('v=spf1'))
  const spfBrevo = !!spf && /spf\.brevo\.com|spf\.sendinblue\.com/i.test(spf)
  out.push(!spf
    ? { group: 'Email', name: `SPF for ${domain}`, status: 'fail', detail: 'No SPF record — inboxes can’t tell Brevo is allowed to send for you.', fix: `Add a TXT record on ${domain}: v=spf1 include:spf.brevo.com ~all (or add include:spf.brevo.com to your existing SPF record).` }
    : !spfBrevo && brevo
      ? { group: 'Email', name: `SPF for ${domain}`, status: 'warn', detail: `SPF exists but doesn’t include Brevo: ${spf}`, fix: 'Add include:spf.brevo.com to that SPF record.' }
      : { group: 'Email', name: `SPF for ${domain}`, status: 'ok', detail: spf })

  const [b1, b2, mailTxt] = await Promise.all([cname(`brevo1._domainkey.${domain}`), cname(`brevo2._domainkey.${domain}`), txt(`mail._domainkey.${domain}`)])
  const dkim = (b1 && b2) || (mailTxt && mailTxt.some((r) => /v=DKIM1|k=rsa|p=/i.test(r)))
  out.push(dkim
    ? { group: 'Email', name: `DKIM for ${domain}`, status: 'ok', detail: b1 && b2 ? 'Brevo DKIM records found (brevo1/brevo2).' : 'DKIM key found (mail._domainkey).' }
    : { group: 'Email', name: `DKIM for ${domain}`, status: 'fail', detail: 'No DKIM signature records found — emails are more likely to land in spam.', fix: 'In Brevo → Senders, Domains & Dedicated IPs → Domains, authenticate the domain and add the DKIM records it shows to your DNS.' })

  const dmarc = (await txt(`_dmarc.${domain}`))?.find((r) => r.toUpperCase().startsWith('V=DMARC1'))
  const policy = dmarc?.match(/;\s*p=(\w+)/i)?.[1]?.toLowerCase()
  out.push(!dmarc
    ? { group: 'Email', name: `DMARC for ${domain}`, status: 'fail', detail: 'No DMARC record — Gmail and Yahoo now expect one from senders.', fix: `Add a TXT record named _dmarc.${domain}: v=DMARC1; p=none; rua=mailto:dmarc@${domain} (move to p=quarantine once reports look clean).` }
    : { group: 'Email', name: `DMARC for ${domain}`, status: policy === 'none' ? 'warn' : 'ok', detail: dmarc, ...(policy === 'none' ? { fix: 'Policy is p=none (monitoring only). Once SPF and DKIM pass, change it to p=quarantine.' } : {}) })
  return out
}

export async function systemChecks(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = []
  const sentry = !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)
  checks.push(sentry
    ? { group: 'Monitoring', name: 'Error tracking (Sentry)', status: 'ok', detail: 'Errors are being recorded.' }
    : { group: 'Monitoring', name: 'Error tracking (Sentry)', status: 'warn', detail: 'Not switched on — errors members hit aren’t recorded anywhere.', fix: 'Create a free Sentry project (Next.js) and add SENTRY_DSN in Railway → Variables.' })
  checks.push(pushEnabled()
    ? { group: 'Members', name: 'Phone alerts (web push)', status: 'ok', detail: 'Alerts can be sent.' }
    : { group: 'Members', name: 'Phone alerts (web push)', status: 'fail', detail: 'Push keys are missing, so no phone alerts are sent.', fix: 'Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Railway (generate with npx web-push generate-vapid-keys).' })
  const admins = await db.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { username: true, totpEnabledAt: true } })
  const without = admins.filter((a) => !a.totpEnabledAt).map((a) => `@${a.username}`)
  checks.push(!mfaRequired()
    ? { group: 'Security', name: 'Admin two-step login', status: 'fail', detail: 'Switched off (ADMIN_2FA_REQUIRED=false).', fix: 'Remove ADMIN_2FA_REQUIRED from Railway → Variables once you can sign in again.' }
    : without.length
      ? { group: 'Security', name: 'Admin two-step login', status: 'warn', detail: `Not set up yet: ${without.join(', ')}. They’ll be asked the next time they open admin.` }
      : { group: 'Security', name: 'Admin two-step login', status: 'ok', detail: `All ${admins.length} admins use it.` })
  return [...checks, ...(await emailChecks())]
}
