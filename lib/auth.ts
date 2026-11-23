import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { isSuperAdminEmail } from '@/lib/admin-roles'
import { getClientIp, rateLimit, resetRateLimit } from '@/lib/rate-limit'
import { hashToken } from '@/lib/security'
import { isProfileReady, profileReadySelect } from '@/lib/profile-ready'
import { deviceHash, describeDevice, mfaRequired, redeemTicket } from '@/lib/admin-mfa'
import { escapeHtml, sendBrandedEmail } from '@/lib/email'

/**
 * How often (seconds) the JWT re-reads role / isActive / username from the
 * database. Demotions, bans and password resets take effect within this
 * window. Override with AUTH_REFRESH_SECONDS (e.g. for testing).
 */
const REFRESH_SECONDS = (() => {
  const n = Number(process.env.AUTH_REFRESH_SECONDS)
  return Number.isFinite(n) && n >= 0 ? n : 300
})()

const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_PER_EMAIL = 10
const LOGIN_MAX_PER_IP = 30

// Used to keep timing roughly constant when the email doesn't exist.
const DUMMY_HASH = '$2a$12$HcfaN1RmVKnLklZhCsDRLO1leBsce90eUOQno3iZBDkcVoT7onWW.'

class RateLimitedSignin extends CredentialsSignin {
  code = 'rate_limited'
}

/** Short fingerprint of the password hash: changes when the password changes. */
function passwordVersion(passwordHash: string | null | undefined): string {
  return passwordHash ? hashToken(passwordHash).slice(0, 16) : ''
}

/**
 * Admins: email them when their account signs in from a browser/device it
 * hasn't used before (never blocks sign-in).
 */
async function alertNewAdminDevice(userId: string, email: string, ua: string, ip: string) {
  try {
    const h = deviceHash(userId, ua)
    const u = await db.user.findUnique({ where: { id: userId }, select: { knownDeviceHashes: true } })
    if (!u || u.knownDeviceHashes.includes(h)) return
    await db.user.update({ where: { id: userId }, data: { knownDeviceHashes: [h, ...u.knownDeviceHashes].slice(0, 20) } })
    const when = new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short' })
    const site = (process.env.NEXT_PUBLIC_APP_URL || 'https://unboundza.com').replace(/\/+$/, '')
    await sendBrandedEmail(
      email,
      'New sign-in to your Unbound admin account',
      'New admin sign-in',
      `<p style="color:#ddd;font-size:15px;line-height:1.6;">Your admin account just signed in from a device it hasn’t used before:</p>
       <p style="color:#fff;font-size:15px;line-height:1.6;"><strong>${escapeHtml(describeDevice(ua))}</strong><br>${escapeHtml(when)} (SAST)<br>IP address ${escapeHtml(ip)}</p>
       <p style="color:#ddd;font-size:15px;line-height:1.6;">If this was you, there’s nothing to do. If it wasn’t, <a href="${escapeHtml(site)}/auth/forgot-password" style="color:#FF4D6D;">reset your password now</a> and tell the super admin.</p>`,
    )
  } catch (err) {
    console.error('new-device alert failed:', err instanceof Error ? err.message : err)
  }
}

async function updateLoginStreak(userId: string) {
  try {
    const dbUser = await db.user.findUnique({
      where: { id: userId },
      select: { loginStreak: true, lastLoginDate: true },
    })
    if (!dbUser) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const last = dbUser.lastLoginDate ? new Date(dbUser.lastLoginDate) : null
    if (last) last.setHours(0, 0, 0, 0)

    const isToday = last && last.getTime() === today.getTime()
    const isYesterday = last && today.getTime() - last.getTime() === 86400000

    if (!isToday) {
      const newStreak = isYesterday ? dbUser.loginStreak + 1 : 1
      // Milestone rewards: every 7 days streak → +1 super like credit
      const milestone = newStreak % 7 === 0
      await db.user.update({
        where: { id: userId },
        data: {
          loginStreak: newStreak,
          lastLoginDate: new Date(),
          ...(milestone ? { superLikeCredits: { increment: 1 } } : {}),
        },
      })
    }
  } catch {
    /* non-critical */
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        const email = typeof credentials?.email === 'string' ? credentials.email.trim() : ''
        const password = typeof credentials?.password === 'string' ? credentials.password : ''
        if (!email || !password || email.length > 254 || password.length > 256) return null

        const ip = request?.headers ? getClientIp(request.headers) : 'unknown'
        const emailKey = `login:email:${email.toLowerCase()}`
        const ipOk = rateLimit(`login:ip:${ip}`, LOGIN_MAX_PER_IP, LOGIN_WINDOW_MS)
        const emailOk = rateLimit(emailKey, LOGIN_MAX_PER_EMAIL, LOGIN_WINDOW_MS)
        if (!ipOk || !emailOk) throw new RateLimitedSignin()

        try {
          const select = {
            id: true,
            email: true,
            username: true,
            passwordHash: true,
            role: true,
            isActive: true,
            emailVerifiedAt: true,
            profile: { select: profileReadySelect },
          } as const
          // Exact match first; fall back to a case-insensitive match because
          // emails were historically stored exactly as typed.
          const user =
            (await db.user.findUnique({ where: { email }, select })) ??
            (await db.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select }))

          if (!user || !user.passwordHash) {
            await bcrypt.compare(password, DUMMY_HASH)
            return null
          }

          const isValid = await bcrypt.compare(password, user.passwordHash)
          if (!isValid || !user.isActive) return null

          resetRateLimit(emailKey)
          if (user.role === 'ADMIN') {
            const ua = request?.headers?.get?.('user-agent') ?? ''
            void alertNewAdminDevice(user.id, user.email, ua, ip)
          }
          return {
            id: user.id,
            email: user.email,
            name: user.username,
            username: user.username,
            role: user.role,
            pwv: passwordVersion(user.passwordHash),
            emailConfirmed: !!user.emailVerifiedAt,
            profileReady: isProfileReady(user.role, user.profile),
          }
        } catch (err) {
          console.error('authorize error:', err instanceof Error ? err.message : err)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const now = Date.now()

      // Admin two-step login: the browser passes the one-time ticket from
      // /api/admin/2fa/verify through useSession().update({ mfaTicket }).
      if (trigger === 'update' && token.id && (session as { mfaTicket?: unknown } | undefined)?.mfaTicket) {
        if (await redeemTicket(token.id as string, (session as { mfaTicket: unknown }).mfaTicket)) token.mfaOk = true
        return token
      }

      if (user) {
        // Fresh sign-in
        token.id = user.id
        token.username = (user as { username?: string }).username ?? ''
        token.role = (user as { role?: string }).role ?? 'USER'
        token.pwv = (user as { pwv?: string }).pwv ?? ''
        token.emailConfirmed = (user as { emailConfirmed?: boolean }).emailConfirmed ?? false
        token.profileReady = (user as { profileReady?: boolean }).profileReady ?? false
        token.mfaOk = false
        token.refreshedAt = now
        if (user.id) await updateLoginStreak(user.id)
        return token
      }

      if (!token.id) return null

      const refreshedAt = typeof token.refreshedAt === 'number' ? token.refreshedAt : 0
      // Unverified emails and unfinished profiles re-check on every request so
      // confirming / finishing onboarding takes effect at once.
      if (token.emailConfirmed !== false && token.profileReady !== false && now - refreshedAt < REFRESH_SECONDS * 1000) return token

      // Periodically re-validate against the database so bans, demotions and
      // password resets take effect without waiting for the user to sign out.
      let dbUser: {
        username: string; role: string; isActive: boolean; passwordHash: string | null; emailVerifiedAt: Date | null
        profile: Parameters<typeof isProfileReady>[1]
      } | null
      try {
        dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { username: true, role: true, isActive: true, passwordHash: true, emailVerifiedAt: true, profile: { select: profileReadySelect } },
        })
      } catch (err) {
        // DB hiccup: keep the existing session rather than logging everyone out.
        console.error('session refresh failed:', err instanceof Error ? err.message : err)
        return token
      }

      if (!dbUser || !dbUser.isActive) return null

      const pwv = passwordVersion(dbUser.passwordHash)
      // Tokens issued before pwv existed adopt the current value.
      if (token.pwv && token.pwv !== pwv) return null

      token.username = dbUser.username
      token.name = dbUser.username
      token.role = dbUser.role
      token.pwv = pwv
      token.emailConfirmed = !!dbUser.emailVerifiedAt
      token.profileReady = isProfileReady(dbUser.role, dbUser.profile)
      token.refreshedAt = now
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        ;(session.user as { username?: string }).username = token.username as string
        // An admin who hasn't entered their two-step code yet is a normal member
        // everywhere (fails closed) until they verify at /auth/admin-verify.
        const pending = token.role === 'ADMIN' && mfaRequired() && token.mfaOk !== true
        ;(session.user as { role?: string }).role = pending ? 'USER' : (token.role as string)
        ;(session.user as { adminPending?: boolean }).adminPending = pending
        ;(session.user as { emailConfirmed?: boolean }).emailConfirmed = token.emailConfirmed !== false
        ;(session.user as { profileReady?: boolean }).profileReady = token.profileReady !== false
      }
      return session
    },
  },
})

/**
 * Authoritative admin check for API routes and admin pages: verifies the
 * role in the database, not just the (possibly up to REFRESH_SECONDS old)
 * session token. Returns the admin's id (and whether they are a super admin), or null.
 */
export async function requireAdmin(): Promise<{ id: string; isSuperAdmin: boolean } | null> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return null
  // Two-step code not entered yet (see the session callback).
  if ((session.user as { adminPending?: boolean }).adminPending) return null
  try {
    const user = await db.user.findUnique({ where: { id }, select: { role: true, isActive: true, email: true } })
    if (!user || !user.isActive || user.role !== 'ADMIN') return null
    return { id, isSuperAdmin: isSuperAdminEmail(user.email) }
  } catch {
    return null
  }
}

/** Like requireAdmin, but only for super admins (who may appoint/remove admins). */
export async function requireSuperAdmin(): Promise<{ id: string; isSuperAdmin: true } | null> {
  const admin = await requireAdmin()
  return admin?.isSuperAdmin ? { id: admin.id, isSuperAdmin: true } : null
}
