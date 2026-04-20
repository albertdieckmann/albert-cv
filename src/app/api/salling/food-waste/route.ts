import { NextRequest, NextResponse } from 'next/server'

const TOKEN = process.env.SALLING_API_TOKEN

export async function GET(req: NextRequest) {
  if (!TOKEN) {
    return NextResponse.json({ error: 'SALLING_API_TOKEN mangler i env' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const zip = searchParams.get('zip')
  const storeId = searchParams.get('store')

  let url: string
  if (storeId) {
    url = `https://api.sallinggroup.com/v1/food-waste/${storeId}`
  } else if (zip) {
    url = `https://api.sallinggroup.com/v1/food-waste?zip=${encodeURIComponent(zip)}`
  } else {
    return NextResponse.json({ error: 'Angiv ?zip=XXXX eller ?store=ID' }, { status: 400 })
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/json',
    },
    next: { revalidate: 300 }, // cache 5 min
  })

  if (!res.ok) {
    const text = await res.text()
    console.error(`[salling] ${res.status} for ${url}:`, text)
    return NextResponse.json({ error: `Salling API svarede ${res.status}`, detail: text, url }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
  })
}
