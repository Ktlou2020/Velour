import { db } from '@/lib/db'
import { isSuperAdminEmail } from '@/lib/admin-roles'
import { sendPushToUser } from '@/lib/push'

export type RoleChangeResult =
  | { ok: true; user: { id: string; username: string; role: string } }
  | { ok: false; status: number; error: string }

/**
 * Appoint or remove an admin. The caller must already be verified as a super
 * admin. Super admins themselves can't be removed here (they are managed via
 * SUPER_ADMIN_EMAILS). Every change is written to AdminAuditLog and the member
 * is notified.
 */
export async function changeAdminRole(actorId: string, targetId: string, makeAdmin: boolean): Promise<RoleChangeResult> {
  const target = await db.user.findUnique({
    where: { id: targetId },
    select: { id: true, username: true, email: true, role: true, isActive: true },
  })
  if (!target) return { ok: false, status: 404, error: 'User not found' }
  if (isSuperAdminEmail(target.email)) {
    return { ok: false, status: 400, error: 'Super admins are managed by the platform owner and cannot be changed here' }
  }
  if (makeAdmin && !target.isActive) {
    return { ok: false, status: 400, error: 'Unban this member before appointing them as an admin' }
  }
  const role = makeAdmin ? 'ADMIN' : 'USER'
  if (target.role === role) {
    return { ok: true, user: { id: target.id, username: target.username, role } }
  }

  const [updated] = await db.$transaction([
    db.user.update({ where: { id: targetId }, data: { role }, select: { id: true, username: true, role: true } }),
    db.adminAuditLog.create({
      data: {
        actorId,
        action: makeAdmin ? 'ADMIN_APPOINTED' : 'ADMIN_REMOVED',
        targetId,
        meta: { username: target.username },
      },
    }),
    db.notification.create({
      data: {
        userId: targetId,
        type: 'SYSTEM',
        title: makeAdmin ? 'You are now a Hush admin' : 'Admin access removed',
        body: makeAdmin
          ? 'You have been appointed as an admin. Open the admin panel from your account menu.'
          : 'Your admin access has been removed.',
        data: { url: makeAdmin ? '/admin' : '/members' },
      },
    }),
  ])
  sendPushToUser(targetId, {
    title: makeAdmin ? 'You are now a Hush admin' : 'Admin access removed',
    body: makeAdmin ? 'Open the admin panel from your account menu.' : 'Your admin access has been removed.',
    url: makeAdmin ? '/admin' : '/members',
    tag: 'admin-role',
  }).catch(() => {})
  return { ok: true, user: updated }
}

export async function audit(actorId: string, action: string, targetId: string | null, meta?: Record<string, unknown>) {
  try {
    await db.adminAuditLog.create({ data: { actorId, action, targetId, meta: meta as object | undefined } })
  } catch (error) {
    console.error('admin audit failed:', error instanceof Error ? error.message : error)
  }
}
