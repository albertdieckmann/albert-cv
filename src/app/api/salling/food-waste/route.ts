import { NextRequest, NextResponse } from 'next/server'

const TOKEN = process.env.SALLING_API_TOKEN
const BASE = 'https://api.sallinggroup.com/v1/food-waste/'

export async function GET(req: NextRequest) {
  if (!TOKEN) {
    return NextResponse.json(
      { error: 'SALLING_API_TOKEN er ikke sat som environment variable i Vercel' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(req.url)
  const zip = searchParams.get('zip')
  const storeId = searchParams.get('store')
  const geo = searchParams.get('geo')
  const radius = searchParams.get('radius') ?? '5'

  let url: string
  if (storeId) {
    url = `${BASE}${encodeURIComponent(storeId)}`
  } else if (geo) {
    url = `${BASE}?geo=${encodeURIComponent(geo)}&radius=${encodeURIComponent(radius)}`
  } else if (zip) {
    url = `${BASE}?zip=${encodeURIComponent(zip)}`
  } else {
    return NextResponse.json(
      { error: 'Angiv ?zip=XXXX, ?geo=lat,lon&radius=km eller ?store=ID' },
      { status: 400 }
    )
  }

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/json',
      },
      // Undgå Next.js-cache der kan give stale data
      cache: 'no-store',
    })

    const text = await res.text()

    if (!res.ok) {
      console.error(`[salling] ${res.status} for ${url}:`, text)
      return NextResponse.json(
        { error: `Salling API svarede ${res.status}`, detail: text, url },
        { status: res.status }
      )
    }

    // Parse og send videre med kort cache
    const data = JSON.parse(text)
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    })
  } catch (e) {
    console.error('[salling] fetch fejl:', e)
    return NextResponse.json(
      { error: 'Netværksfejl ved kald til Salling API', detail: String(e) },
      { status: 502 }
    )
  }
}
