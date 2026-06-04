import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const checks: Record<string, boolean | string> = {
    server: true,
    nextauth_secret: !!process.env.NEXTAUTH_SECRET,
    database: false,
  }

  try {
    await db.$queryRaw`SELECT 1`
    checks.database = true
  } catch (e) {
    checks.database = String(e)
  }

  const allOk = checks.server && checks.nextauth_secret && checks.database === true
  return NextResponse.json({ status: allOk ? 'ok' : 'degraded', checks }, { status: allOk ? 200 : 503 })
}
