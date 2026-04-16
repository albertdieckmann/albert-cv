import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import yaml from 'js-yaml'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const REPO = 'albertdieckmann/albert-cv'
const BRANCH = 'main'

async function getFileSha(path: string): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}?ref=${BRANCH}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  )
  if (!res.ok) return null
  const data = await res.json() as { sha: string }
  return data.sha
}

async function putFile(path: string, content: string, sha: string | null, message: string) {
  const encoded = Buffer.from(content).toString('base64')
  const body: Record<string, unknown> = { message, content: encoded, branch: BRANCH }
  if (sha) body.sha = sha // sha er påkrævet ved opdatering, ikke ved oprettelse
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(JSON.stringify(err))
  }
}

async function deleteFile(path: string, sha: string, message: string) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, sha, branch: BRANCH }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(JSON.stringify(err))
  }
}

async function listExpFiles(): Promise<string[]> {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/content/experience?ref=${BRANCH}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  )
  if (!res.ok) return []
  const data = await res.json() as Array<{ name: string }>
  return data.map(f => f.name.replace('.yaml', ''))
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!GITHUB_TOKEN) return NextResponse.json({ error: 'GITHUB_TOKEN mangler i env' }, { status: 500 })

  const { section, data } = await req.json() as { section: string; data: Record<string, unknown> }

  try {
    if (section === 'experience') {
      const entries = data.entries as Array<{ slug: string } & Record<string, unknown>>

      // Find filer der skal slettes (eksisterer på GitHub men ikke i entries)
      const existingSlugs = await listExpFiles()
      const newSlugs = new Set(entries.map(e => e.slug))
      const toDelete = existingSlugs.filter(s => !newSlugs.has(s))

      // Slet fjernede poster
      for (const slug of toDelete) {
        const path = `content/experience/${slug}.yaml`
        const sha = await getFileSha(path)
        if (sha) await deleteFile(path, sha, `Slet erfaring: ${slug}`)
      }

      // Opret eller opdater alle poster
      for (const entry of entries) {
        const { slug, ...entryData } = entry
        const path = `content/experience/${slug}.yaml`
        const sha = await getFileSha(path) // null = ny fil
        const content = yaml.dump(entryData, { lineWidth: -1 })
        await putFile(path, content, sha, sha ? `Opdater erfaring: ${entryData.title}` : `Tilføj erfaring: ${entryData.title}`)
      }
    } else {
      const path = `content/${section}.yaml`
      const sha = await getFileSha(path)
      const content = yaml.dump(data, { lineWidth: -1 })
      await putFile(path, content, sha, `Opdater indhold: ${section}`)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
