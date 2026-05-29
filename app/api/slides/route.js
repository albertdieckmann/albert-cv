import { neon } from '@neondatabase/serverless'

export async function GET() {
  const sql = neon(process.env.DATABASE_URL)
  const slides = await sql`SELECT * FROM rf_slides WHERE active = true ORDER BY id`
  return Response.json(slides)
}
