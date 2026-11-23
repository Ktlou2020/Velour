// Prints the same checks as Admin → System health (lib/system-health.ts) to the
// deploy log at startup, so they can be read without signing in. Settings are
// reported as set / not set only — never their values. Never fails the start.
import { promises as dns } from 'dns'
import { PrismaClient } from '@prisma/client'

const has = (k) => !!(process.env[k] && process.env[k].trim())
const txt = async (n) => { try { return (await dns.resolveTxt(n)).map((r) => r.join('')) } catch (e) { return { error: e.code } } }
const cname = async (n) => { try { return await dns.resolveCname(n) } catch (e) { return { error: e.code } } }
const log = (...a) => console.log('[health]', ...a)

try {
  const from = process.env.EMAIL_FROM ?? 'Unbound <noreply@unboundza.com>'
  const domain = (from.match(/@([^>\s]+)/)?.[1] ?? 'unboundza.com').toLowerCase()
  log('email provider:', has('BREVO_API_KEY') ? 'Brevo set' : has('EMAIL_HOST') ? 'SMTP set' : 'NOT SET')
  log('email from domain:', domain)
  const root = await txt(domain)
  log('SPF:', Array.isArray(root) ? (root.find((r) => r.toLowerCase().startsWith('v=spf1')) ?? 'none (TXT: ' + JSON.stringify(root) + ')') : root)
  log('DKIM brevo1:', JSON.stringify(await cname(`brevo1._domainkey.${domain}`)))
  log('DKIM brevo2:', JSON.stringify(await cname(`brevo2._domainkey.${domain}`)))
  log('DKIM mail._domainkey:', JSON.stringify(await txt(`mail._domainkey.${domain}`)))
  log('DMARC:', JSON.stringify(await txt(`_dmarc.${domain}`)))
  log('Sentry:', has('SENTRY_DSN') || has('NEXT_PUBLIC_SENTRY_DSN') ? 'set' : 'NOT SET')
  log('web push keys:', has('VAPID_PUBLIC_KEY') && has('VAPID_PRIVATE_KEY') ? 'set' : 'NOT SET')
  log('cron secret:', has('CRON_SECRET') ? 'set' : 'NOT SET')
  log('admin two-step:', process.env.ADMIN_2FA_REQUIRED === 'false' ? 'SWITCHED OFF' : 'required')
  const db = new PrismaClient()
  const admins = await db.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { username: true, totpEnabledAt: true } })
  log('admins:', admins.map((a) => `@${a.username} (${a.totpEnabledAt ? 'two-step on' : 'two-step not set up'})`).join(', ') || 'none')
  await db.$disconnect()
} catch (e) {
  log('report failed:', e instanceof Error ? e.message : e)
}
