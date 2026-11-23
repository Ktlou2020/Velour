import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { db } from '@/lib/db'
import { newSecret, otpauthUri, seal } from '@/lib/admin-mfa'
import { adminIdentity } from '../shared'

/** POST → { qrSvg, secret }: a new secret to scan (switched on once a code from it is verified). */
export async function POST() {
  const me = await adminIdentity()
  if (!me) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const u = await db.user.findUnique({ where: { id: me.id }, select: { totpEnabledAt: true } })
  if (u?.totpEnabledAt) return NextResponse.json({ error: 'Two-step login is already set up' }, { status: 400 })
  const secret = newSecret()
  await db.user.update({ where: { id: me.id }, data: { totpPendingSecret: seal(secret) } })
  const qrSvg = await QRCode.toString(otpauthUri(secret, me.username), { type: 'svg', margin: 1, color: { dark: '#0A0A0F', light: '#FFFFFF' } })
  return NextResponse.json({ qrSvg, secret: secret.match(/.{1,4}/g)?.join(' ') ?? secret }, { headers: { 'Cache-Control': 'no-store' } })
}
