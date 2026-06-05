// Modtager nyt lineup fra GitHub Action-scraper.
// Beskyttet af ROSKILDE_INGEST_TOKEN (repo secret).
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

const MIN_ITEMS = 50;
const KNOWN_STAGES = ["Orange", "Arena", "Apollo", "Gloria", "Avalon", "Pavilion", "Countdown"];

type Item = {
  name?: string;
  appearances?: { date?: string }[];
  date?: string;
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-ingest-token");
  if (!process.env.ROSKILDE_INGEST_TOKEN || token !== process.env.ROSKILDE_INGEST_TOKEN) {
    return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });
  }

  const body = await req.json();
  const items: Item[] = body?.items ?? [];

  if (items.length < MIN_ITEMS) {
    return NextResponse.json(
      { error: `Kun ${items.length} items — forventet mindst ${MIN_ITEMS}. Last-good bevares.` },
      { status: 422 }
    );
  }

  const stages = new Set(
    items.map((it) => (it as Record<string, unknown>)?.lineupSceneLabel as string)
  );
  if (!KNOWN_STAGES.some((s) => stages.has(s))) {
    return NextResponse.json({ error: "Ingen kendte scenenavne — afviser data." }, { status: 422 });
  }

  // Hent nuværende last-good for at diff appearance_dates
  let changedPicks = 0;
  try {
    const prev = await sql`
      SELECT data FROM roskilde_lineup_cache ORDER BY fetched_at DESC LIMIT 1
    `;

    if (prev.rows.length) {
      const prevItems: Item[] = prev.rows[0].data?.items ?? [];
      const prevMap = new Map<string, string[]>();
      for (const it of prevItems) {
        if (!it.name) continue;
        const dates = it.appearances?.map((a) => a.date ?? "").filter(Boolean)
          ?? (it.date ? [it.date] : []);
        prevMap.set(it.name, dates);
      }

      // For hvert act i ny data: tjek om appearance_dates har ændret sig
      for (const it of items) {
        if (!it.name) continue;
        const newDates = it.appearances?.map((a) => a.date ?? "").filter(Boolean)
          ?? (it.date ? [it.date] : []);
        const oldDates = prevMap.get(it.name) ?? [];

        // Find old dates der ikke længere findes i ny data
        for (const oldDate of oldDates) {
          if (!oldDate || newDates.includes(oldDate)) continue;
          // Hvis ny data har præcis én ny date og vi tabte præcis én gammel → flyt picks
          if (newDates.length === oldDates.length && newDates.length === 1) {
            const newDate = newDates[0];
            const result = await sql`
              UPDATE roskilde_picks_v2
              SET appearance_date = ${newDate}, updated_at = NOW()
              WHERE act_name = ${it.name} AND appearance_date = ${oldDate}
            `;
            changedPicks += result.rowCount ?? 0;
          }
        }
      }
    }
  } catch {
    // Diff-migration er best-effort — gå videre med ingest
  }

  await sql`
    INSERT INTO roskilde_lineup_cache (item_count, data)
    VALUES (${items.length}, ${JSON.stringify(body)}::jsonb)
  `;

  await sql`
    DELETE FROM roskilde_lineup_cache
    WHERE id NOT IN (
      SELECT id FROM roskilde_lineup_cache ORDER BY fetched_at DESC LIMIT 5
    )
  `;

  return NextResponse.json({ ok: true, itemCount: items.length, migratedPicks: changedPicks });
}
