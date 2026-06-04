import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import crypto from 'crypto'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

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
