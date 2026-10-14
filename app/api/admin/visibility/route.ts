import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/auth'
import { db } from '@/lib/db'
import { distanceKm } from '@/lib/geo'
import { categoryOf, effectiveInterestedIn } from '@/lib/identity'
import { DEFAULT_RADIUS_KM, getCallerContext, mutualInterestWhere, notSnoozed } from '@/app/api/members/search'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/visibility?viewer=<username>&target=<username>
 * Support diagnostic: would `target` appear in `viewer`'s member search, and
 * if not, which rule hides them? Mirrors app/api/members/search.ts.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const sp = new URL(req.url).searchParams
    const vName = sp.get('viewer') ?? ''
    const tName = sp.get('target') ?? ''
    if (!vName || !tName || vName.length > 64 || tName.length > 64) {
      return NextResponse.json({ error: 'viewer and target usernames are required' }, { status: 400 })
    }
    const sel = {
      id: true, username: true, isActive: true, role: true,
      profile: {
        select: {
          gender: true, isCouple: true, interestedIn: true, lookingFor: true, city: true,
          latitude: true, longitude: true, isSnoozed: true, snoozedUntil: true, dateOfBirth: true, membershipTier: true,
        },
      },
    } as const
    const [viewer, target] = await Promise.all([
      db.user.findUnique({ where: { username: vName }, select: sel }),
      db.user.findUnique({ where: { username: tName }, select: sel }),
    ])
    if (!viewer || !target) {
      return NextResponse.json({ error: `${!viewer ? 'viewer' : 'target'} not found` }, { status: 404 })
    }

    type Check = { rule: string; ok: boolean; detail: string }
    const checks: Check[] = []
    const add = (rule: string, ok: boolean, detail: string) => checks.push({ rule, ok, detail })

    add('different_people', viewer.id !== target.id, viewer.id === target.id ? 'Viewer and target are the same account.' : 'OK')
    add('target_active', target.isActive, target.isActive ? 'OK' : 'Target account is deactivated/banned.')
    add('viewer_active', viewer.isActive, viewer.isActive ? 'OK' : 'Viewer account is deactivated/banned (cannot sign in).')
    add('target_profile', !!target.profile, target.profile ? 'OK' : 'Target has no profile row.')
    add('viewer_profile', !!viewer.profile, viewer.profile ? 'OK' : 'Viewer has no profile row.')

    const vp = viewer.profile, tp = target.profile
    const missing = (p: typeof vp) => p ? [
      ...(!p.gender && !p.isCouple ? ['gender'] : []),
      ...(!(p.interestedIn?.length) && !(p.lookingFor?.length) ? ['interestedIn'] : []),
      ...(!p.city ? ['city'] : []),
      ...(p.latitude == null || p.longitude == null ? ['location'] : []),
    ] : ['profile']
    const tMissing = missing(tp), vMissing = missing(vp)
    // Informational: incomplete onboarding doesn't hide anyone by itself, but
    // missing gender/preferences/location change matching and distance.
    add('onboarding_target', tMissing.length === 0, tMissing.length ? `Target onboarding incomplete: missing ${tMissing.join(', ')} (does not hide by itself).` : 'OK')
    add('onboarding_viewer', vMissing.length === 0, vMissing.length ? `Viewer onboarding incomplete: missing ${vMissing.join(', ')} (does not hide by itself).` : 'OK')

    const snoozed = await db.profile.count({ where: { userId: target.id, ...notSnoozed() } }) === 0 && !!tp
    add('target_not_snoozed', !snoozed, snoozed ? `Target is snoozed${tp?.snoozedUntil ? ` until ${tp.snoozedUntil.toISOString()}` : ' indefinitely'}.` : 'OK')

    const block = await db.block.findFirst({
      where: { OR: [{ blockerId: viewer.id, blockedId: target.id }, { blockerId: target.id, blockedId: viewer.id }] },
      select: { blockerId: true },
    })
    add('not_blocked', !block, block ? `${block.blockerId === viewer.id ? 'Viewer blocked target' : 'Target blocked viewer'}.` : 'OK')

    // Mutual interest: each half of mutualInterestWhere evaluated separately.
    const caller = await getCallerContext(viewer.id, viewer.role)
    const vCat = vp ? categoryOf(vp) : null, tCat = tp ? categoryOf(tp) : null
    const vWants = vp ? effectiveInterestedIn(vp) : [], tWants = tp ? effectiveInterestedIn(tp) : []
    let viewerWantsTarget = true, targetWantsViewer = true
    if (tp) {
      if (caller.interestedIn.length) {
        const [half] = mutualInterestWhere({ category: null, interestedIn: caller.interestedIn })
        viewerWantsTarget = (await db.profile.count({ where: { userId: target.id, AND: [half] } })) > 0
      }
      if (caller.category) {
        const [half] = mutualInterestWhere({ category: caller.category, interestedIn: [] })
        targetWantsViewer = (await db.profile.count({ where: { userId: target.id, AND: [half] } })) > 0
      }
    }
    add('viewer_wants_target', viewerWantsTarget,
      viewerWantsTarget ? 'OK' : `Viewer wants [${vWants.join(', ') || 'anyone'}] but target is ${tCat ?? 'unknown'} (gender=${tp?.gender ?? 'null'}, couple=${!!tp?.isCouple}).`)
    add('target_wants_viewer', targetWantsViewer,
      targetWantsViewer ? 'OK' : `Target wants [${tWants.join(', ') || 'anyone'}] (interestedIn=[${tp?.interestedIn.join(', ')}], lookingFor=[${tp?.lookingFor.join(', ')}]) but viewer is ${vCat ?? 'unknown'}.`)

    // Distance vs the default radius and the plan's "Further away" cap
    const radius = caller.role === 'ADMIN' ? caller.ent.maxSearchRadiusKm : Math.min(DEFAULT_RADIUS_KM, caller.ent.maxSearchRadiusKm ?? Infinity)
    const cap = caller.ent.maxSearchRadiusKm
    let km: number | null = null
    if (caller.latitude != null && caller.longitude != null && tp?.latitude != null && tp?.longitude != null) {
      km = Math.round(distanceKm(caller.latitude, caller.longitude, tp.latitude, tp.longitude) * 10) / 10
    }
    const withinCap = km === null || cap === null || km <= cap + 0.5
    add('distance', withinCap,
      km === null
        ? (caller.latitude == null ? 'Viewer has no location: no distance filter (everyone matching is listed).' : 'Target has no location: listed under "Distance unknown".')
        : withinCap
          ? (radius === null || km <= radius + 0.5 ? `${km} km — inside the default ${radius === null ? 'Anywhere' : `${radius} km`} radius.` : `${km} km — beyond the default ${radius} km radius, shown under "Further away".`)
          : `${km} km — beyond the ${cap} km maximum for the viewer's plan (${caller.tier}).`)

    const hiddenBy = checks.filter((c) => !c.ok && !c.rule.startsWith('onboarding')).map((c) => c.rule)
    return NextResponse.json({
      viewer: { username: viewer.username, plan: caller.tier, category: vCat, interestedIn: vWants, travel: caller.travel?.city ?? null },
      target: { username: target.username, category: tCat, interestedIn: tWants },
      distanceKm: km,
      visibleInSearch: hiddenBy.length === 0,
      hiddenBy,
      checks,
      note: 'Discover additionally hides members the viewer liked, or passed on in the last 5 days.',
    })
  } catch (error) {
    console.error('GET /api/admin/visibility error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
