import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { email?: string; token?: string }
    const { email, token } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Log the unsubscribe request.
    // In a production system this would update a user preference field
    // (e.g. emailOptOut: true) in the database.
    console.log(`Unsubscribe request: email=${email}, token=${token ?? '(none)'}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/unsubscribe error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
