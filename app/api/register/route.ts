import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { sendVerificationEmail } from '@/lib/email'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { BCRYPT_COST, generateToken, hashToken, validatePassword } from '@/lib/security'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,30}$/

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers)
    if (!rateLimit(`register:ip:${ip}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null) as {
      username?: unknown
      email?: unknown
      password?: unknown
      dateOfBirth?: unknown
    } | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const dateOfBirth = typeof body.dateOfBirth === 'string' ? body.dateOfBirth : ''

    if (!username || !email || !password || !dateOfBirth) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-30 characters: letters, numbers, dots, dashes or underscores' },
        { status: 400 }
      )
    }

    const passwordError = validatePassword(password, { email, username })
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const dob = new Date(dateOfBirth)
    if (isNaN(dob.getTime())) {
      return NextResponse.json({ error: 'Invalid date of birth' }, { status: 400 })
    }

    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--
    }
    if (age < 18) {
      return NextResponse.json(
        { error: 'You must be at least 18 years old to register' },
        { status: 400 }
      )
    }

    const existingEmail = await db.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    })
    if (existingEmail) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    const existingUsername = await db.user.findUnique({ where: { username }, select: { id: true } })
    if (existingUsername) {
      return NextResponse.json(
        { error: 'This username is already taken' },
        { status: 409 }
      )
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST)

    const user = await db.user.create({
      data: {
        email,
        username,
        passwordHash,
        isActive: true,
        isVerified: false,
        role: 'USER',
      },
    })

    await db.profile.create({
      data: {
        userId: user.id,
        dateOfBirth: dob,
        profileCompleteness: 20,
      },
    })

    // Send verification email (non-blocking)
    try {
      const verifyToken = generateToken()
      const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
      // Only the SHA-256 of the token is stored; the raw token is emailed.
      await db.user.update({
        where: { id: user.id },
        data: { emailVerifyToken: hashToken(verifyToken), emailVerifyExpiry: verifyExpiry },
      })
      await sendVerificationEmail(email, verifyToken)
    } catch (emailError) {
      console.error('Failed to send verification email after registration:', emailError instanceof Error ? emailError.message : emailError)
    }

    return NextResponse.json(
      { success: true, message: 'Account created' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
