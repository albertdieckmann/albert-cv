import { neon } from '@neondatabase/serverless'

export async function GET() {
  const sql = neon(process.env.DATABASE_URL)
  const rows = await sql`
    SELECT body FROM rf_slides 
    WHERE type = 'news' AND active = true 
    ORDER BY updated_at DESC LIMIT 1
  `
  if (!rows.length) return Response.json([])
  return Response.json(JSON.parse(rows[0].body))
}

export async function POST(req) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const articles = await req.json()
  const sql = neon(process.env.DATABASE_URL)

  await sql`DELETE FROM rf_slides WHERE type = 'news'`
  await sql`
    INSERT INTO rf_slides (type, title, body, active, weight)
    VALUES ('news', 'Nyheder fra RF', ${JSON.stringify(articles)}, true, 2)
  `

  return Response.json({ ok: true, count: articles.length })
}
