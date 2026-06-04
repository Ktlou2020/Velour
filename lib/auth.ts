import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email as string
        const password = credentials.password as string

        try {
          const user = await db.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              username: true,
              passwordHash: true,
              role: true,
              isActive: true,
            },
          })

          if (!user || !user.passwordHash) return null
          if (!user.isActive) return null

          const isValid = await bcrypt.compare(password, user.passwordHash)
          if (!isValid) return null

          return {
            id: user.id,
            email: user.email,
            name: user.username,
            username: user.username,
            role: user.role,
          }
        } catch {
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.username = (user as { username?: string }).username ?? ''
        token.role = (user as { role?: string }).role ?? 'USER'

        // Update login streak on every new sign-in
        try {
          const dbUser = await db.user.findUnique({
            where: { id: user.id as string },
            select: { loginStreak: true, lastLoginDate: true, superLikeCredits: true },
          })
          if (dbUser) {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const last = dbUser.lastLoginDate ? new Date(dbUser.lastLoginDate) : null
            if (last) last.setHours(0, 0, 0, 0)

            const isToday = last && last.getTime() === today.getTime()
            const isYesterday = last && (today.getTime() - last.getTime() === 86400000)

            if (!isToday) {
              const newStreak = isYesterday ? (dbUser.loginStreak + 1) : 1
              // Milestone rewards: every 7 days streak → +1 super like credit
              const milestone = newStreak % 7 === 0
              await db.user.update({
                where: { id: user.id as string },
                data: {
                  loginStreak: newStreak,
                  lastLoginDate: new Date(),
                  ...(milestone ? { superLikeCredits: { increment: 1 } } : {}),
                },
              })
            }
          }
        } catch { /* non-critical */ }
      }
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
