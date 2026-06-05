// Kald POST /api/roskilde/setup én gang for at oprette v2-tabeller.
// Beskyt med header x-setup-token = ROSKILDE_SETUP_TOKEN.
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-setup-token");
  if (
    process.env.ROSKILDE_SETUP_TOKEN &&
    token !== process.env.ROSKILDE_SETUP_TOKEN
  ) {
    return NextResponse.json({ error: "Uautoriseret" }, { status: 401 });
  }

  await sql`
    CREATE TABLE IF NOT EXISTS roskilde_groups_v2 (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(100) NOT NULL,
      share_token VARCHAR(20) NOT NULL UNIQUE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS roskilde_members (
      member_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id     UUID NOT NULL REFERENCES roskilde_groups_v2(id) ON DELETE CASCADE,
      display_name VARCHAR(80) NOT NULL,
      recall_code  VARCHAR(6) NOT NULL,
      joined_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (group_id, recall_code)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS roskilde_picks_v2 (
      member_id  UUID NOT NULL REFERENCES roskilde_members(member_id) ON DELETE CASCADE,
      group_id   UUID NOT NULL REFERENCES roskilde_groups_v2(id) ON DELETE CASCADE,
      act_name   VARCHAR(200) NOT NULL,
      category   VARCHAR(20) NOT NULL CHECK (category IN ('interested','going','has_ticket')),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (member_id, act_name)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS roskilde_lineup_cache (
      id         SERIAL PRIMARY KEY,
      fetched_at TIMESTAMPTZ DEFAULT NOW(),
      item_count INTEGER NOT NULL,
      data       JSONB NOT NULL
    )
  `;

  return NextResponse.json({ ok: true, message: "Roskilde v2-tabeller oprettet." });
}
