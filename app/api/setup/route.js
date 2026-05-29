import { neon } from '@neondatabase/serverless'

export async function GET() {
  const sql = neon(process.env.DATABASE_URL)
  
  await sql`
    CREATE TABLE IF NOT EXISTS rf_slides (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT,
      body TEXT,
      active BOOLEAN DEFAULT true,
      weight INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `

  await sql`
    INSERT INTO rf_slides (type, title, active, weight)
    VALUES 
      ('weather', 'Vejr', true, 2),
      ('program', 'Program', true, 2),
      ('hours', 'Åbningstider', true, 1)
    ON CONFLICT DO NOTHING
  `

  return Response.json({ ok: true, message: 'Database sat op' })
}

