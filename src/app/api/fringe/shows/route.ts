import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import type { Area } from "@/lib/fringe-area";

// Local type — mirrors Show in src/app/fringe/types.ts (kept separate to avoid CSS module import on server)
type Show = {
  id: string;
  title: string;
  subTitle?: string;
  artist?: string;
  genre?: string;
  descriptionTeaser?: string;
  website?: string;
  venue: { name: string; area: Area };
  performances: { start: string; end: string; durationMinutes?: number; price?: number; priceString?: string }[];
};

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const result = await sql`
      SELECT data FROM fringe_shows_cache ORDER BY id
    `;

    if (result.rows.length === 0) {
      // Cache is empty — return empty with a hint so the client knows to try later
      return NextResponse.json({ items: [], count: 0, cacheEmpty: true });
    }

    const items: Show[] = result.rows.map((r) => r.data as Show);
    return NextResponse.json({ items, count: items.length });
  } catch (err) {
    console.error("[fringe/shows] DB read failed:", err);
    return NextResponse.json({ items: [], error: "Failed to load shows" }, { status: 500 });
  }
}
