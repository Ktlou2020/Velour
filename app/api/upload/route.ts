import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import crypto from 'crypto'
import { db } from '@/lib/db'
import { isPlatinum } from '@/lib/premium'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_VIDEO_SIZE = 30 * 1024 * 1024 // 30MB
const MAX_VIDEO_SECONDS = 31

function sign(params: string, apiSecret: string) {
  return crypto.createHash('sha256').update(params + apiSecret).digest('hex')
}

async function handleVideoUpload(file: File, userId: string, cloudName: string, apiKey: string, apiSecret: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, profile: { select: { membershipTier: true } } },
  })
  if (!isPlatinum(user?.profile?.membershipTier, user?.role)) {
    return NextResponse.json({ error: 'Video profiles are a Platinum feature' }, { status: 403 })
  }
  if (!file.type.startsWith('video/')) {
    return NextResponse.json({ error: 'Only video files are accepted' }, { status: 400 })
  }
  if (file.size > MAX_VIDEO_SIZE) {
    return NextResponse.json({ error: 'Video must be under 30MB' }, { status: 400 })
  }

  const timestamp = Math.round(Date.now() / 1000)
  const folder = 'velour/videos'
  const signature = sign(`folder=${folder}&timestamp=${timestamp}`, apiSecret)

  const uploadForm = new FormData()
  uploadForm.append('file', file)
  uploadForm.append('api_key', apiKey)
  uploadForm.append('timestamp', String(timestamp))
  uploadForm.append('signature', signature)
  uploadForm.append('folder', folder)

  const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
    method: 'POST',
    body: uploadForm,
  })
  if (!uploadResponse.ok) {
    const errorData = await uploadResponse.json().catch(() => ({}))
    console.error('Cloudinary video upload error:', errorData)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const data = await uploadResponse.json() as { secure_url: string; public_id?: string; duration?: number }
  const duration = typeof data.duration === 'number' ? data.duration : null

  if (duration !== null && duration > MAX_VIDEO_SECONDS) {
    // Best-effort cleanup of the rejected upload
    if (data.public_id) {
      const ts = Math.round(Date.now() / 1000)
      const destroyForm = new FormData()
      destroyForm.append('public_id', data.public_id)
      destroyForm.append('api_key', apiKey)
      destroyForm.append('timestamp', String(ts))
      destroyForm.append('signature', sign(`public_id=${data.public_id}&timestamp=${ts}`, apiSecret))
      fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/destroy`, { method: 'POST', body: destroyForm }).catch(() => {})
    }
    return NextResponse.json({ error: 'Video must be 30 seconds or shorter' }, { status: 400 })
  }

  const url = data.secure_url
  // Poster frame: same asset rendered as a JPG
  const posterUrl = url.replace(/\.[a-z0-9]+$/i, '.jpg')
  return NextResponse.json({ url, posterUrl, duration }, { status: 201 })
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (formData.get('kind') === 'video') {
      return handleVideoUpload(file, session.user.id, cloudName, apiKey, apiSecret)
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are accepted' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size must be under 10MB' }, { status: 400 })
    }

    const timestamp = Math.round(Date.now() / 1000)
    const folder = 'velour/photos'

    // Build signature string (params sorted alphabetically)
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}`
    const signature = crypto
      .createHash('sha256')
      .update(paramsToSign + apiSecret)
      .digest('hex')

    // Build upload form data
    const uploadForm = new FormData()
    uploadForm.append('file', file)
    uploadForm.append('api_key', apiKey)
    uploadForm.append('timestamp', String(timestamp))
    uploadForm.append('signature', signature)
    uploadForm.append('folder', folder)

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: uploadForm,
      }
    )

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({}))
      console.error('Cloudinary upload error:', errorData)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const data = await uploadResponse.json()
    const url: string = data.secure_url

    // Build thumbnail URL by inserting transformation into Cloudinary URL
    // Replace /upload/ with /upload/w_300,h_300,c_fill/
    const thumbnailUrl = url.replace('/upload/', '/upload/w_300,h_300,c_fill/')

    return NextResponse.json({ url, thumbnailUrl }, { status: 201 })
  } catch (error) {
    console.error('POST /api/upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
