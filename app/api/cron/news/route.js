import { neon } from '@neondatabase/serverless'

export async function GET(req) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const res = await fetch('https://www.roskilde-festival.dk/nyheder', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'da-DK,da;q=0.9',
    }
  })

  const html = await res.text()
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) return Response.json({ error: 'ingen __NEXT_DATA__' })

  const data = JSON.parse(match[1])
  const items = data?.pageProps?.modules?.[0]?.data?.items

  if (!items?.length) return Response.json({ error: 'ingen items', keys: Object.keys(data?.pageProps || {}) })

  const articles = items.slice(0, 10).map(item => ({
    headline: item.headline,
    text: item.text,
    category: item.category,
    date: item.date,
    url: 'https://www.roskilde-festival.dk' + item.url,
  }))

  const sql = neon(process.env.DATABASE_URL)
  await sql`
    DELETE FROM rf_slides WHERE type = 'news'
  `
  await sql`
    INSERT INTO rf_slides (type, title, body, active, weight)
    VALUES ('news', 'Nyheder fra RF', ${JSON.stringify(articles)}, true, 2)
  `

  return Response.json({ ok: true, count: articles.length })
}
