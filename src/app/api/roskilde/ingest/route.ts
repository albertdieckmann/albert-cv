// Modtager nyt lineup fra GitHub Action-scraper.
// Beskyttet af ROSKILDE_INGEST_TOKEN (repo secret).
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

const MIN_ITEMS = 50;
const KNOWN_STAGES = ["Orange", "Arena", "Apollo", "Gloria", "Avalon", "Pavilion", "Countdown"];

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-ingest-token");
  if (!process.env.ROSKILDE_INGEST_TOKEN || token !== process.env.ROSKILDE_INGEST_TOKEN) {
    return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });
  }

  const body = await req.json();
  const items: unknown[] = body?.items ?? [];

  // Validering: afvis tomt eller halvt resultat
  if (items.length < MIN_ITEMS) {
    return NextResponse.json(
      { error: `Kun ${items.length} items — forventet mindst ${MIN_ITEMS}. Last-good bevares.` },
      { status: 422 }
    );
  }

  // Tjek at mindst én kendt scene er repræsenteret
  const stages = new Set(
    items.map((it: unknown) => (it as Record<string, unknown>)?.lineupSceneLabel as string)
  );
  const hasKnownStage = KNOWN_STAGES.some((s) => stages.has(s));
  if (!hasKnownStage) {
    return NextResponse.json(
      { error: "Ingen kendte scenenavne fundet — afviser data." },
      { status: 422 }
    );
  }

  await sql`
    INSERT INTO roskilde_lineup_cache (item_count, data)
    VALUES (${items.length}, ${JSON.stringify(body)}::jsonb)
  `;

  // Bevar kun de 5 nyeste versioner
  await sql`
    DELETE FROM roskilde_lineup_cache
    WHERE id NOT IN (
      SELECT id FROM roskilde_lineup_cache ORDER BY fetched_at DESC LIMIT 5
    )
  `;

  return NextResponse.json({ ok: true, itemCount: items.length });
}
