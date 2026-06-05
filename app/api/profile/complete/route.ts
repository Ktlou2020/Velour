import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/db'

// Milestones: 0=none, 1=40% reached (+1 SL), 2=70% reached (+2 SL), 3=100% reached (+3 SL)
const MILESTONES = [
  { threshold: 40,  level: 1, credits: 1, label: '40% complete' },
  { threshold: 70,  level: 2, credits: 2, label: '70% complete' },
  { threshold: 100, level: 3, credits: 3, label: 'Profile complete!' },
]

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user.id

    const [user, profile, photos] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { completionMilestone: true, superLikeCredits: true } }),
      db.profile.findUnique({ where: { userId }, select: { displayName: true, bio: true, dateOfBirth: true, gender: true, orientation: true, relationshipStatus: true, city: true, country: true, profilePhoto: true } }),
      db.photo.findMany({ where: { userId, isProfile: true }, take: 1 }),
    ])

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const fields = {
      displayName: !!profile?.displayName,
      bio: !!profile?.bio,
      dateOfBirth: !!profile?.dateOfBirth,
      gender: !!profile?.gender,
      orientation: !!profile?.orientation,
      relationshipStatus: !!profile?.relationshipStatus,
      city: !!profile?.city,
      country: !!profile?.country,
      profilePhoto: !!(photos.length > 0 || profile?.profilePhoto),
      lookingFor: true, // always true (optional)
    }

    const filled = Object.values(fields).filter(Boolean).length
    const completeness = Math.round((filled / 9) * 100) // 9 meaningful fields

    const currentMilestone = user.completionMilestone ?? 0
    const newMilestones = MILESTONES.filter(m => m.level > currentMilestone && completeness >= m.threshold)
    const highestNew = newMilestones[newMilestones.length - 1]

    let creditsAwarded = 0
    if (highestNew) {
      // Award credits for all newly crossed milestones
      creditsAwarded = newMilestones.reduce((sum, m) => sum + m.credits, 0)
      await db.user.update({
        where: { id: userId },
        data: {
          completionMilestone: highestNew.level,
          superLikeCredits: { increment: creditsAwarded },
        },
      })
    }

    // Update stored completeness
    await db.profile.update({
      where: { userId },
      data: { profileCompleteness: completeness },
    }).catch(() => {})

    return NextResponse.json({
      completeness,
      creditsAwarded,
      milestone: highestNew?.label ?? null,
      missingFields: Object.entries(fields).filter(([, v]) => !v).map(([k]) => k),
    })
  } catch (error) {
    console.error('POST /api/profile/complete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
