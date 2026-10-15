import { NextResponse } from 'next/server'
import { foundingSpots } from '@/lib/founding'

export const dynamic = 'force-dynamic'

/** Public: how many founding-member spots (Platinum free forever) are left. */
export async function GET() {
  try {
    const spots = await foundingSpots()
    return NextResponse.json(spots, { headers: { 'Cache-Control': 'public, max-age=30' } })
  } catch {
    return NextResponse.json({ limit: 0, claimed: 0, left: 0 })
  }
}
