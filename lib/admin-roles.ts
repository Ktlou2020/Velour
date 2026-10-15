/**
 * Super admins are the owners of the platform. They are regular ADMIN accounts
 * (so every existing admin check keeps working) whose email is listed in
 * SUPER_ADMIN_EMAILS. Only a super admin may appoint or remove admins, and a
 * super admin can't be banned or demoted from the admin panel.
 */
export const DEFAULT_SUPER_ADMIN_EMAILS = 'thuto231990@gmail.com'

export function superAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? DEFAULT_SUPER_ADMIN_EMAILS)
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  return !!email && superAdminEmails().includes(email.trim().toLowerCase())
}
