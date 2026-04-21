// Kald dette endpoint én gang efter deployment for at oprette DB-tabellerne.
// Kræver at du er logget ind som admin (Clerk-bruger).
// DELETE eller beskyt dette endpoint bagefter.

import { auth } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  await sql`
    CREATE TABLE IF NOT EXISTS roskilde_groups (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      created_by VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS roskilde_group_members (
      group_id INTEGER NOT NULL REFERENCES roskilde_groups(id) ON DELETE CASCADE,
      user_id VARCHAR(100) NOT NULL,
      user_name VARCHAR(100) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (group_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS roskilde_invites (
      id SERIAL PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      group_id INTEGER NOT NULL REFERENCES roskilde_groups(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      used_by VARCHAR(100),
      used_at TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS roskilde_picks (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL,
      user_id VARCHAR(100) NOT NULL,
      user_name VARCHAR(100) NOT NULL,
      act_name VARCHAR(200) NOT NULL,
      category VARCHAR(20) NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (group_id, user_id, act_name)
    )
  `;

  return NextResponse.json({ ok: true, message: "Tabeller oprettet." });
}
