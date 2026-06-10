// POST /api/roskilde/migrate
// Migrerer eksisterende v2-data (member-baserede picks) til v3 (user-baserede picks).
// Idempotent: springer members over der allerede har user_id.
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

  // Tilføj user_id-kolonne på members hvis den ikke findes
  await sql`
    ALTER TABLE roskilde_members
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES roskilde_users(user_id) ON DELETE CASCADE
  `;

  // Gør display_name nullable — nye members identificeres via user_id
  await sql`
    ALTER TABLE roskilde_members
    ALTER COLUMN display_name DROP NOT NULL
  `;

  // Hent alle members der endnu ikke har en user
  const members = await sql`
    SELECT member_id, display_name FROM roskilde_members WHERE user_id IS NULL
  `;

  let migrated = 0;
  for (const m of members.rows) {
    const userResult = await sql`
      INSERT INTO roskilde_users (display_name)
      VALUES (${m.display_name})
      RETURNING user_id
    `;
    const userId = userResult.rows[0].user_id;

    await sql`
      UPDATE roskilde_members SET user_id = ${userId} WHERE member_id = ${m.member_id}
    `;

    await sql`
      INSERT INTO roskilde_picks_v3 (user_id, act_name, appearance_date, category, updated_at)
      SELECT ${userId}, act_name, appearance_date, category, updated_at
      FROM roskilde_picks_v2
      WHERE member_id = ${m.member_id}
      ON CONFLICT (user_id, act_name, appearance_date) DO NOTHING
    `;

    migrated++;
  }

  return NextResponse.json({ ok: true, migrated });
}
