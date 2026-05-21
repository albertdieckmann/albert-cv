import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function GET() { return runMigrate(); }
export async function POST() { return runMigrate(); }

async function runMigrate() {
  const steps: string[] = [];

  // ── fringe_picks: performance_id ────────────────────────────────────────────
  await sql`ALTER TABLE fringe_picks ADD COLUMN IF NOT EXISTS performance_id TEXT`;
  steps.push("picks.performance_id column added");

  await sql`
    UPDATE fringe_picks
    SET performance_id = performance_start::text
    WHERE performance_start IS NOT NULL AND performance_id IS NULL
  `;
  steps.push("picks.performance_id backfilled from performance_start");

  await sql`ALTER TABLE fringe_picks DROP CONSTRAINT IF EXISTS picks_perf_required`;
  await sql`
    ALTER TABLE fringe_picks
    ADD CONSTRAINT picks_perf_required
    CHECK (status = 'interested' OR performance_id IS NOT NULL) NOT VALID
  `;
  steps.push("picks constraint added (NOT VALID — existing rows grandfathered)");

  // ── fringe_purchases: performance_id ────────────────────────────────────────
  await sql`ALTER TABLE fringe_purchases ADD COLUMN IF NOT EXISTS performance_id TEXT`;
  await sql`
    UPDATE fringe_purchases
    SET performance_id = performance_start::text
    WHERE performance_start IS NOT NULL AND performance_id IS NULL
  `;
  steps.push("purchases.performance_id column added + backfilled");

  // ── fringe_groups: travel dates ─────────────────────────────────────────────
  await sql`ALTER TABLE fringe_groups ADD COLUMN IF NOT EXISTS start_date DATE`;
  await sql`ALTER TABLE fringe_groups ADD COLUMN IF NOT EXISTS end_date DATE`;
  steps.push("groups.start_date + end_date added");

  // ── fringe_venues ────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS fringe_venues (
      id       SERIAL PRIMARY KEY,
      name     TEXT NOT NULL,
      address  TEXT,
      postcode TEXT,
      lat      FLOAT,
      lon      FLOAT,
      area     TEXT NOT NULL DEFAULT 'other',
      UNIQUE(name)
    )
  `;
  steps.push("fringe_venues table created");

  return NextResponse.json({ ok: true, steps });
}
