import { NextRequest, NextResponse } from 'next/server'

const TOKEN = process.env.SALLING_API_TOKEN

// Endpoint: justér hvis Salling bruger et andet path
const BASE = 'https://api.sallinggroup.com/v1/promotions/'

export async function GET(req: NextRequest) {
  if (!TOKEN) {
    return NextResponse.json(
      { error: 'SALLING_API_TOKEN er ikke sat som environment variable i Vercel' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(req.url)
  const storeId = searchParams.get('storeId')
  const zip = searchParams.get('zip')

  const params = new URLSearchParams()
  if (storeId) params.set('storeId', storeId)
  if (zip) params.set('zip', zip)

  const url = `${BASE}${params.toString() ? `?${params}` : ''}`

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    const text = await res.text()

    if (!res.ok) {
      console.error(`[salling/promotions] ${res.status} for ${url}:`, text)
      return NextResponse.json(
        { error: `Salling Promotions API svarede ${res.status}`, detail: text, url },
        { status: res.status }
      )
    }

    return NextResponse.json(JSON.parse(text), {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300' },
    })
  } catch (e) {
    console.error('[salling/promotions] fetch fejl:', e)
    return NextResponse.json(
      { error: 'Netværksfejl ved kald til Salling Promotions API', detail: String(e) },
      { status: 502 }
    )
  }
}
