import { auth } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  await sql`
    CREATE TABLE IF NOT EXISTS fringe_groups (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      created_by VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS fringe_group_members (
      group_id  INTEGER NOT NULL REFERENCES fringe_groups(id) ON DELETE CASCADE,
      user_id   VARCHAR(100) NOT NULL,
      user_name VARCHAR(100) NOT NULL,
      role      VARCHAR(20)  NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (group_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS fringe_invites (
      id         SERIAL PRIMARY KEY,
      code       VARCHAR(20) NOT NULL UNIQUE,
      group_id   INTEGER NOT NULL REFERENCES fringe_groups(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      used_by    VARCHAR(100),
      used_at    TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS fringe_picks (
      id                SERIAL PRIMARY KEY,
      group_id          INTEGER      NOT NULL,
      user_id           VARCHAR(100) NOT NULL,
      user_name         VARCHAR(100) NOT NULL,
      show_id           VARCHAR(500) NOT NULL,
      show_title        VARCHAR(300) NOT NULL,
      status            VARCHAR(20)  NOT NULL,
      performance_start TIMESTAMPTZ,
      performance_end   TIMESTAMPTZ,
      updated_at        TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (group_id, user_id, show_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS fringe_purchases (
      id                SERIAL PRIMARY KEY,
      group_id          INTEGER      NOT NULL,
      buyer_user_id     VARCHAR(100) NOT NULL,
      buyer_user_name   VARCHAR(100) NOT NULL,
      show_id           VARCHAR(500) NOT NULL,
      show_title        VARCHAR(300) NOT NULL,
      performance_start TIMESTAMPTZ,
      quantity          INTEGER      NOT NULL DEFAULT 1,
      total_cost        NUMERIC(8,2),
      notes             TEXT,
      purchased_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS fringe_purchase_covers (
      purchase_id       INTEGER      NOT NULL REFERENCES fringe_purchases(id) ON DELETE CASCADE,
      covered_user_id   VARCHAR(100) NOT NULL,
      covered_user_name VARCHAR(100) NOT NULL,
      settled           BOOLEAN      NOT NULL DEFAULT FALSE,
      settled_at        TIMESTAMPTZ,
      PRIMARY KEY (purchase_id, covered_user_id)
    )
  `;

  return NextResponse.json({ ok: true, message: "Fringe-tabeller oprettet." });
}
