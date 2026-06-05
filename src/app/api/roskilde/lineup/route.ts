import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    // DB-cache først (seneste gode ingest)
    const result = await sql`
      SELECT data FROM roskilde_lineup_cache
      ORDER BY fetched_at DESC
      LIMIT 1
    `;
    if (result.rows.length) {
      return NextResponse.json(result.rows[0].data);
    }
  } catch {
    // DB ikke klar — fald igennem til fil
  }

  try {
    const filePath = join(process.cwd(), "public", "roskilde", "lineup.json" /* turbopackIgnore: true */);
    const raw = readFileSync(filePath, "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ items: [] });
  }
}
