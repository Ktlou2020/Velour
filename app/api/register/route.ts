import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { sendVerificationEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      '127.0.0.1';

    if (!rateLimit(ip, 5, 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json()
    const { username, email, password, dateOfBirth } = body as {
      username?: string
      email?: string
      password?: string
      dateOfBirth?: string
    }

    if (!username || !email || !password || !dateOfBirth) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
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

    const existingEmail = await db.user.findUnique({ where: { email } })
    if (existingEmail) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    const existingUsername = await db.user.findUnique({ where: { username } })
    if (existingUsername) {
      return NextResponse.json(
        { error: 'This username is already taken' },
        { status: 409 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)

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
      const verifyToken = crypto.randomBytes(32).toString('hex')
      const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await db.user.update({
        where: { id: user.id },
        data: { emailVerifyToken: verifyToken, emailVerifyExpiry: verifyExpiry },
      })
      await sendVerificationEmail(email, verifyToken)
    } catch (emailError) {
      console.error('Failed to send verification email after registration:', emailError)
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
