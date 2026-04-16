import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import sharp from 'sharp'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const REPO = 'albertdieckmann/albert-cv'
const BRANCH = 'main'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!GITHUB_TOKEN) return NextResponse.json({ error: 'GITHUB_TOKEN mangler' }, { status: 500 })

  const { filename, base64, contentType } = await req.json() as {
    filename: string
    base64: string
    contentType: string
  }

  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'Kun billeder tilladt' }, { status: 400 })
  }

  // Konverter til JPEG via sharp (håndterer HEIC, PNG, WebP, osv.)
  const inputBuffer = Buffer.from(base64, 'base64')
  const jpegBuffer = await sharp(inputBuffer)
    .rotate() // respekter EXIF-rotation (vigtigt for iPhone-billeder)
    .jpeg({ quality: 85 })
    .toBuffer()

  // Brug altid .jpg extension
  const jpegFilename = filename.replace(/\.[^.]+$/, '') + '.jpg'
  const encodedContent = jpegBuffer.toString('base64')
  const path = `public/gallery/${jpegFilename}`

  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Upload billede: ${jpegFilename}`,
      content: encodedContent,
      branch: BRANCH,
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    return NextResponse.json({ error: JSON.stringify(err) }, { status: 500 })
  }

  return NextResponse.json({ ok: true, filename: jpegFilename })
}
