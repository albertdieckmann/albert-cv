import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

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

  const path = `public/gallery/${filename}`

  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Upload billede: ${filename}`,
      content: base64,
      branch: BRANCH,
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    return NextResponse.json({ error: JSON.stringify(err) }, { status: 500 })
  }

  return NextResponse.json({ ok: true, filename })
}
