import { auth } from '@/auth'
import { db } from '@/lib/db'

/**
 * The signed-in admin, checked in the database, whether or not they've
 * entered their two-step code yet (setup/verify happen before that).
 */
export async function adminIdentity(): Promise<{ id: string; email: string; username: string } | null> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return null
  const u = await db.user.findUnique({ where: { id }, select: { role: true, isActive: true, email: true, username: true } })
  return u && u.isActive && u.role === 'ADMIN' ? { id, email: u.email, username: u.username } : null
}
