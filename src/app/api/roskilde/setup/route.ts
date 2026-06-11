// POST /api/roskilde/setup          — opretter tabeller (idempotent)
// POST /api/roskilde/setup?reset=1  — dropper og genopretter (kræver token + ikke prod)
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

  const reset = new URL(req.url).searchParams.get("reset") === "1";

  if (reset && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "reset=1 er ikke tilladt i produktion" },
      { status: 403 }
    );
  }

  if (reset) {
    await sql`DROP TABLE IF EXISTS rf_checkins CASCADE`;
    await sql`DROP TABLE IF EXISTS rf_group_places CASCADE`;
    await sql`DROP TABLE IF EXISTS roskilde_picks_v3 CASCADE`;
    await sql`DROP TABLE IF EXISTS roskilde_picks_v2 CASCADE`;
    await sql`DROP TABLE IF EXISTS roskilde_members CASCADE`;
    await sql`DROP TABLE IF EXISTS roskilde_users CASCADE`;
    await sql`DROP TABLE IF EXISTS roskilde_groups_v2 CASCADE`;
    await sql`DROP TABLE IF EXISTS roskilde_lineup_cache CASCADE`;
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
    CREATE TABLE IF NOT EXISTS roskilde_users (
      user_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      display_name VARCHAR(80) NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS roskilde_members (
      member_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID REFERENCES roskilde_users(user_id) ON DELETE CASCADE,
      group_id     UUID NOT NULL REFERENCES roskilde_groups_v2(id) ON DELETE CASCADE,
      display_name VARCHAR(80),
      recall_code  VARCHAR(6) NOT NULL,
      joined_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (group_id, recall_code)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS roskilde_picks_v2 (
      member_id       UUID NOT NULL,
      group_id        UUID NOT NULL,
      act_name        VARCHAR(200) NOT NULL,
      appearance_date VARCHAR(30)  NOT NULL DEFAULT '',
      category        VARCHAR(20)  NOT NULL CHECK (category IN ('interested','going','has_ticket')),
      updated_at      TIMESTAMPTZ  DEFAULT NOW(),
      PRIMARY KEY (member_id, act_name, appearance_date)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS roskilde_picks_v3 (
      user_id         UUID NOT NULL REFERENCES roskilde_users(user_id) ON DELETE CASCADE,
      act_name        VARCHAR(200) NOT NULL,
      appearance_date VARCHAR(30)  NOT NULL DEFAULT '',
      category        VARCHAR(20)  NOT NULL CHECK (category IN ('interested','going','has_ticket')),
      updated_at      TIMESTAMPTZ  DEFAULT NOW(),
      PRIMARY KEY (user_id, act_name, appearance_date)
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

  await sql`
    CREATE TABLE IF NOT EXISTS rf_group_places (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id    UUID NOT NULL REFERENCES roskilde_groups_v2(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      emoji       TEXT,
      created_by  UUID REFERENCES roskilde_members(member_id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_places_group ON rf_group_places (group_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS rf_checkins (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_id        UUID NOT NULL REFERENCES roskilde_groups_v2(id) ON DELETE CASCADE,
      member_id       UUID NOT NULL REFERENCES roskilde_members(member_id) ON DELETE CASCADE,
      target_type     TEXT NOT NULL CHECK (target_type IN ('performance', 'place')),
      performance_id  TEXT,
      place_id        UUID REFERENCES rf_group_places(id) ON DELETE CASCADE,
      checked_in_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at      TIMESTAMPTZ NOT NULL,
      checked_out_at  TIMESTAMPTZ,
      CHECK (
        (target_type = 'performance' AND performance_id IS NOT NULL AND place_id IS NULL)
        OR
        (target_type = 'place' AND place_id IS NOT NULL AND performance_id IS NULL)
      )
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_checkins_group_active
      ON rf_checkins (group_id, expires_at)
      WHERE checked_out_at IS NULL
  `;

  return NextResponse.json({
    ok: true,
    message: reset ? "Tabeller nulstillet og oprettet." : "Roskilde-tabeller oprettet (IF NOT EXISTS).",
  });
}
