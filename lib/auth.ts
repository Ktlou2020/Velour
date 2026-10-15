import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { isSuperAdminEmail } from '@/lib/admin-roles'
import { getClientIp, rateLimit, resetRateLimit } from '@/lib/rate-limit'
import { hashToken } from '@/lib/security'

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
          return {
            id: user.id,
            email: user.email,
            name: user.username,
            username: user.username,
            role: user.role,
            pwv: passwordVersion(user.passwordHash),
          }
        } catch (err) {
          console.error('authorize error:', err instanceof Error ? err.message : err)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const now = Date.now()

      if (user) {
        // Fresh sign-in
        token.id = user.id
        token.username = (user as { username?: string }).username ?? ''
        token.role = (user as { role?: string }).role ?? 'USER'
        token.pwv = (user as { pwv?: string }).pwv ?? ''
        token.refreshedAt = now
        if (user.id) await updateLoginStreak(user.id)
        return token
      }

      if (!token.id) return null

      const refreshedAt = typeof token.refreshedAt === 'number' ? token.refreshedAt : 0
      if (now - refreshedAt < REFRESH_SECONDS * 1000) return token

      // Periodically re-validate against the database so bans, demotions and
      // password resets take effect without waiting for the user to sign out.
      let dbUser: { username: string; role: string; isActive: boolean; passwordHash: string | null } | null
      try {
        dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { username: true, role: true, isActive: true, passwordHash: true },
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
      token.refreshedAt = now
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        ;(session.user as { username?: string }).username = token.username as string
        ;(session.user as { role?: string }).role = token.role as string
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
