import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { sendPushToUser } from '@/lib/push'
import { markConversationNotificationsRead, upsertMessageNotification } from '@/lib/notifications'
import { isPaid } from '@/lib/premium'
import { chatVideoRules, checkPriority, getMessageAllowance, messageLimitError } from '@/lib/chat-priority'
import {
  GAME_INFO,
  MAX_ANSWER_TEXT,
  MAX_STATEMENT,
  findChoicePrompt,
  findQuestion,
  fmtDuration,
  gamePreview,
  isGameKind,
  messageForViewer,
  voicePreview,
  type GameMeta,
} from '@/lib/chat-games'
import {
  computeReceipt,
  effectiveExpiry,
  findMatchesBetween,
  getConversationAccess,
  getCoupleMemberNames,
  getPartnerMap,
  sideOf,
} from '@/lib/couples'
import {
  VIEW_ONCE_SELECT,
  VIEW_ONCE_TTL_MS,
  canSendAsViewOnce,
  isViewOnceMedia,
  redactViewOnce,
  sweepViewOnce,
  viewOncePreview,
} from '@/lib/view-once'

const MAX_CONTENT = 2000
const MAX_VOICE_SEC = 60

type Body = {
  content?: unknown
  imageUrl?: unknown
  senderPartnerName?: unknown
  kind?: unknown
  audioUrl?: unknown
  audioDurationSec?: unknown
  videoUrl?: unknown
  videoDurationSec?: unknown
  waveform?: unknown
  game?: unknown
  isPriority?: unknown
  viewOnce?: unknown
}

/** Up to 48 bar heights 0–100 recorded client-side for the voice-note waveform. */
function cleanWaveform(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null
  const out = raw.slice(0, 48).map((v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0))
  return out.length >= 4 ? out : null
}

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  // Strip control characters (keep newlines out of game text)
  const t = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return t && t.length <= max ? t : null
}

/** Validate a new game from the request body → stored meta, or an error message. */
function buildGame(raw: unknown, senderId: string, as: string | null): GameMeta | string {
  if (!raw || typeof raw !== 'object') return 'Choose a game'
  const g = raw as Record<string, unknown>
  if (!isGameKind(g.game)) return 'Unknown game'
  const at = new Date().toISOString()
  if (g.game === 'this_or_that' || g.game === 'would_you_rather') {
    const p = findChoicePrompt(g.game, g.promptId)
    if (!p) return 'Pick a question'
    if (g.choice !== 0 && g.choice !== 1) return 'Make your own pick first'
    return {
      game: g.game, v: 1, promptId: p.id,
      prompt: g.game === 'this_or_that' ? `${p.a} or ${p.b}?` : `Would you rather ${p.a.charAt(0).toLowerCase()}${p.a.slice(1)} or ${p.b.charAt(0).toLowerCase()}${p.b.slice(1)}?`,
      options: [p.a, p.b],
      answers: { [senderId]: { choice: g.choice, as, at } },
    }
  }
  if (g.game === 'questions') {
    const q = findQuestion(g.promptId)
    if (!q) return 'Pick a question'
    const text = g.text === undefined || g.text === '' ? null : cleanText(g.text, MAX_ANSWER_TEXT)
    if (g.text !== undefined && g.text !== '' && !text) return `Answers must be under ${MAX_ANSWER_TEXT} characters`
    return {
      game: 'questions', v: 1, promptId: q.id, prompt: q.q,
      answers: text ? { [senderId]: { text, as, at } } : {},
    }
  }
  // Two truths and a lie
  const statements = Array.isArray(g.statements) ? g.statements.map((x) => cleanText(x, MAX_STATEMENT)) : []
  if (statements.length !== 3 || statements.some((x) => !x)) return `Write three statements (up to ${MAX_STATEMENT} characters each)`
  if (g.lie !== 0 && g.lie !== 1 && g.lie !== 2) return 'Mark which statement is the lie'
  return {
    game: 'two_truths', v: 1, prompt: GAME_INFO.two_truths.title,
    options: statements as string[], lie: g.lie, answers: {},
  }
}

/**
 * Only accept images the sender uploaded to Unbound (`/api/media/<id>`, from
 * POST /api/upload with purpose=chat) or legacy Cloudinary images.
 */
async function isValidImageUrl(raw: unknown, senderId: string): Promise<boolean> {
  const { isSendableChatImage } = await import('@/lib/media-access')
  return isSendableChatImage(raw, senderId)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const role = (session.user as { role?: string }).role

    const { id: conversationId } = await params
    const { searchParams } = new URL(req.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100)

    // Lazy couple sync (adds linked partners / removes ex-partners), then
    // verify user is a participant (and fetch tier for read-receipt gating)
    const access = await getConversationAccess(conversationId, userId)
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const participation = await db.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { unreadCount: true, user: { select: { profile: { select: { membershipTier: true } } } } },
    })

    if (!participation) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const paid = isPaid(participation.user.profile?.membershipTier, role)

    // View-once media that is done (all viewed / 14 days) is deleted lazily on reads too
    await sweepViewOnce({ conversationId, limit: 50 }).catch((e) => console.error('[view-once] lazy sweep failed:', e))

    const messages = await db.message.findMany({
      where: { conversationId },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        views: VIEW_ONCE_SELECT.views,
        sender: {
          select: {
            id: true,
            username: true,
            profile: {
              select: { displayName: true, profilePhoto: true },
            },
          },
        },
      },
    })

    // Mark messages as read (+ readAt for paid senders' read receipts)
    const marked = await db.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    })

    if (marked.count > 0 || participation.unreadCount > 0) {
      await db.$transaction([
        db.conversationParticipant.update({
          where: { conversationId_userId: { conversationId, userId } },
          data: { unreadCount: 0 },
        }),
        // Touch the conversation so the sender's SSE stream picks up the read
        db.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        }),
      ])
    }

    // Opening the chat clears its MESSAGE notifications in the bell / list
    await markConversationNotificationsRead(userId, conversationId)

    const nextCursor = messages.length === limit ? messages[messages.length - 1].id : null

    // Read receipts on your own sent messages are a paid feature
    // With several recipients "read" means every other participant has read it.
    const receipt = paid ? await computeReceipt(conversationId, userId) : null
    const multi = access.userIds.length > 2
    const viewerSide = sideOf(userId, await getPartnerMap(access.userIds))
    const now = Date.now()
    const out = messages.reverse().map((raw) => {
      const m = redactViewOnce(messageForViewer(raw, userId, viewerSide), userId, access.userIds, now)
      if (m.senderId !== userId) return m
      if (!paid) return { ...m, isRead: false, readAt: null }
      if (multi) {
        const isLatest = receipt?.messageId === m.id
        return { ...m, isRead: isLatest ? receipt!.allSeen : m.isRead, seenBy: isLatest ? receipt!.seenBy : undefined }
      }
      return m
    })

    return NextResponse.json({ messages: out, nextCursor, receipt })
  } catch (error) {
    console.error('GET /api/conversations/[id]/messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const { id: conversationId } = await params
    const body = (await req.json().catch(() => ({}))) as Body
    const { content: rawContent, imageUrl: rawImageUrl, senderPartnerName: rawPartnerName } = body
    const kind = body.kind === 'VOICE' || body.kind === 'GAME' || body.kind === 'VIDEO' ? body.kind : 'TEXT'
    const isPriority = body.isPriority === true
    // View once: a chat photo or video each recipient can open one time
    const viewOnce = body.viewOnce === true

    // Text, or an optional caption on a video
    const content = (kind === 'TEXT' || kind === 'VIDEO') && typeof rawContent === 'string' ? rawContent.trim() : ''
    let imageUrl: string | null = null
    if (kind === 'TEXT' && rawImageUrl !== undefined && rawImageUrl !== null && rawImageUrl !== '') {
      if (typeof rawImageUrl !== 'string' || !(await isValidImageUrl(rawImageUrl, userId))) {
        return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })
      }
      imageUrl = rawImageUrl
    }

    // Voice note: our own uploaded audio, duration measured client-side (clamped)
    let audioUrl: string | null = null
    let audioDurationSec: number | null = null
    let waveform: number[] | null = null
    if (kind === 'VOICE') {
      const { isSendableVoiceNote } = await import('@/lib/media-access')
      if (!(await isSendableVoiceNote(body.audioUrl, userId))) {
        return NextResponse.json({ error: 'Invalid voice note' }, { status: 400 })
      }
      audioUrl = body.audioUrl as string
      const d = typeof body.audioDurationSec === 'number' && Number.isFinite(body.audioDurationSec) ? body.audioDurationSec : 1
      audioDurationSec = Math.max(1, Math.min(MAX_VOICE_SEC, Math.round(d)))
      waveform = cleanWaveform(body.waveform)
    }

    // Chat video: our own upload (purpose=chatvideo); length comes from the file, re-checked against the plan
    let videoMeta: { videoUrl: string; durationSec: number | null } | null = null
    if (kind === 'VIDEO') {
      const { sendableChatVideo } = await import('@/lib/media-access')
      const v = await sendableChatVideo(body.videoUrl, userId)
      if (!v) return NextResponse.json({ error: 'Invalid video' }, { status: 400 })
      const rules = await chatVideoRules(userId)
      if (v.durationSec === null && rules.plan === 'FREE') {
        return NextResponse.json({ error: 'We couldn’t read this video’s length. Please try a different MP4 or MOV.' }, { status: 415 })
      }
      if (v.durationSec !== null && v.durationSec > rules.maxSec + 0.5) {
        return NextResponse.json({
          error: rules.plan === 'FREE'
            ? `Free plan videos can be up to ${rules.maxSec} seconds — trim it or go Gold for 60-second videos`
            : `Videos can be up to ${rules.maxSec} seconds on your plan`,
          upgrade: rules.plan !== 'PLATINUM',
        }, { status: 422 })
      }
      let durationSec = v.durationSec
      if (durationSec === null && typeof body.videoDurationSec === 'number' && Number.isFinite(body.videoDurationSec)) {
        durationSec = Math.max(0, Math.min(rules.maxSec, body.videoDurationSec))
      }
      videoMeta = { videoUrl: body.videoUrl as string, durationSec: durationSec === null ? null : Math.round(durationSec * 10) / 10 }
    }

    if (kind === 'TEXT' && !content && !imageUrl) {
      return NextResponse.json({ error: 'content or imageUrl is required' }, { status: 400 })
    }
    const mediaUrlSent = videoMeta?.videoUrl ?? imageUrl
    if (viewOnce) {
      if (!mediaUrlSent || !(await canSendAsViewOnce(mediaUrlSent, userId))) {
        return NextResponse.json({ error: 'View once works with a newly attached photo or video' }, { status: 400 })
      }
    } else if (mediaUrlSent && await isViewOnceMedia(mediaUrlSent)) {
      return NextResponse.json({ error: 'This photo or video was sent as view once' }, { status: 400 })
    }
    if (content.length > MAX_CONTENT) {
      return NextResponse.json({ error: `Message must be under ${MAX_CONTENT} characters` }, { status: 400 })
    }

    // Verify user is a participant (after the lazy couple sync)
    const access = await getConversationAccess(conversationId, userId)
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // A block by/against anyone on either side (incl. linked partners)
    if (access.blocked) {
      return NextResponse.json({ error: 'You can no longer message in this conversation' }, { status: 403 })
    }

    // Shared couple account: which of the two is writing
    const me = await db.profile.findUnique({
      where: { userId },
      select: { isCouple: true, partnerId: true, coupleMembers: true, displayName: true, user: { select: { username: true } } },
    })
    const coupleNames = me?.isCouple && !me.partnerId ? getCoupleMemberNames(me.coupleMembers) : []
    let senderPartnerName: string | null = null
    if (typeof rawPartnerName === 'string' && rawPartnerName.trim()) {
      const wanted = rawPartnerName.trim()
      if (!coupleNames.includes(wanted)) {
        return NextResponse.json({ error: 'Choose who is sending this message' }, { status: 400 })
      }
      senderPartnerName = wanted
    }

    let gameMeta: GameMeta | null = null
    if (kind === 'GAME') {
      const g = buildGame(body.game, userId, senderPartnerName)
      if (typeof g === 'string') return NextResponse.json({ error: g }, { status: 400 })
      gameMeta = g
    }

    const otherParticipants = access.userIds.filter((u) => u !== userId).map((u) => ({ userId: u }))
    const partnerMap = await getPartnerMap(access.userIds)
    const mySide = sideOf(userId, partnerMap)
    const otherSide = access.userIds.filter((u) => !mySide.includes(u))
    const sideMatches = await findMatchesBetween(mySide, otherSide)

    // An expired match (nobody said hi within the window) can't be revived by messaging
    const expiry = effectiveExpiry(sideMatches)
    if (expiry && expiry.getTime() < Date.now()) {
      const anyMessage = await db.message.findFirst({ where: { conversationId }, select: { id: true } })
      if (!anyMessage) {
        return NextResponse.json({ error: 'This match has expired' }, { status: 410 })
      }
    }

    // Priority (Gold 3/week, Platinum unlimited, 1 per conversation per day)
    if (isPriority) {
      const check = await checkPriority(userId, conversationId)
      if (!check.ok) {
        return NextResponse.json(
          { error: check.error, upgrade: check.upgrade ?? false, allowance: check.allowance },
          { status: check.status },
        )
      }
    }

    // Free plan: 5 messages of any kind per rolling 24 hours (per account; new members get a welcome period)
    const quota = await getMessageAllowance(userId)
    if (quota.remaining !== null && quota.remaining <= 0) {
      return NextResponse.json(messageLimitError(quota), { status: 429 })
    }

    const message = await db.message.create({
      data: {
        conversationId,
        senderId: userId,
        content,
        imageUrl,
        senderPartnerName,
        kind: kind === 'TEXT' && imageUrl && !content ? 'IMAGE' : kind,
        audioUrl,
        audioDurationSec,
        isPriority,
        ...(viewOnce ? { viewOnce: true, viewOnceExpiresAt: new Date(Date.now() + VIEW_ONCE_TTL_MS) } : {}),
        ...(gameMeta ? { meta: gameMeta as unknown as Prisma.InputJsonValue } : {}),
        ...(waveform ? { meta: { waveform } } : {}),
        ...(videoMeta ? { meta: videoMeta } : {}),
      },
      include: {
        views: VIEW_ONCE_SELECT.views,
        sender: {
          select: {
            id: true,
            username: true,
            profile: {
              select: { displayName: true, profilePhoto: true },
            },
          },
        },
      },
    })

    const videoLen = videoMeta?.durationSec != null ? ` (${fmtDuration(videoMeta.durationSec)})` : ''
    // View once: never the caption, never "photo"/"video" details beyond the label
    const voPreview = viewOnce ? viewOncePreview(videoMeta ? 'video' : 'photo') : null
    const listPreview = voPreview ? voPreview : kind === 'VOICE'
      ? voicePreview(audioDurationSec)
      : videoMeta
        ? `🎥 Video${videoLen}`
        : gameMeta
        ? gamePreview(gameMeta.game)
        : content ? content.slice(0, 100) : '📷 Photo'
    const preview = voPreview ? voPreview : kind === 'VOICE'
      ? `Sent you a voice note 🎤 (${fmtDuration(audioDurationSec)})`
      : videoMeta
        ? `Sent you a video 🎥${videoLen}`
        : gameMeta
        ? `Sent you a game: ${GAME_INFO[gameMeta.game].title} 🎲`
        : listPreview
    // "Thandi" — or for a linked couple member "Thandi (Thandi & Sipho)"
    const myName = me?.displayName || me?.user.username || 'Someone'
    const partnerOfMe = mySide.find((u) => u !== userId)
    let senderLabel = senderPartnerName || myName
    if (partnerOfMe && access.userIds.includes(partnerOfMe)) {
      const pp = await db.profile.findUnique({
        where: { userId: partnerOfMe },
        select: { displayName: true, user: { select: { username: true } } },
      })
      const pn = pp?.displayName || pp?.user.username
      if (pn) senderLabel = `${myName} (${myName} & ${pn})`
    }

    for (const participant of otherParticipants) {
      await db.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: participant.userId } },
        data: { unreadCount: { increment: 1 } },
      })

      // One unread MESSAGE notification per conversation ("Thandi sent you 3 messages")
      await upsertMessageNotification({
        userId: participant.userId,
        conversationId,
        senderId: userId,
        senderLabel,
        preview,
        isPriority,
        senderPartnerName,
        multi: access.userIds.length > 2,
      })
      sendPushToUser(participant.userId, {
        title: isPriority ? `⚡ ${senderLabel} — Unbound` : `${senderLabel} — Unbound`,
        body: preview,
        url: `/messages?conv=${conversationId}`,
        tag: `message-${conversationId}`,
      }).catch(() => {})
    }

    // Update conversation last message; stop the sender's typing indicator.
    // Done after the recipients' unread counts / notifications so a recipient
    // with this chat open (whose SSE stream reacts to updatedAt and marks the
    // message read) never ends up with a stale unread badge.
    await db.$transaction([
      db.conversation.update({
        where: { id: conversationId },
        data: { lastMessage: listPreview, lastMessageAt: new Date() },
      }),
      db.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { typingUntil: null },
      }),
    ])

    // Extend match expiry — once conversation is active the match never expires
    if (sideMatches.some((m) => m.expiresAt)) {
      db.match.updateMany({
        where: { id: { in: sideMatches.map((m) => m.id) } },
        data: { expiresAt: null },
      }).catch(() => {})
    }

    const messageAllowance = quota.limit === null ? quota : await getMessageAllowance(userId)
    return NextResponse.json({ message: redactViewOnce(message, userId, access.userIds), messageAllowance }, { status: 201 })
  } catch (error) {
    console.error('POST /api/conversations/[id]/messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
