import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

const VALID_CATEGORIES = ["interested", "going", "has_ticket"];

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Mangler user-id" }, { status: 400 });

  const { actName, appearanceDate, category } = await req.json();
  if (!actName) return NextResponse.json({ error: "Manglende actName" }, { status: 400 });
  if (!appearanceDate) return NextResponse.json({ error: "Manglende appearanceDate" }, { status: 400 });
  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Ugyldig kategori" }, { status: 400 });
  }

  const userCheck = await sql`SELECT user_id FROM roskilde_users WHERE user_id = ${userId}`;
  if (!userCheck.rows.length) return NextResponse.json({ error: "Ukendt bruger" }, { status: 403 });

  if (!category) {
    await sql`
      DELETE FROM roskilde_picks_v3
      WHERE user_id = ${userId} AND act_name = ${actName} AND appearance_date = ${appearanceDate}
    `;
  } else {
    await sql`
      INSERT INTO roskilde_picks_v3 (user_id, act_name, appearance_date, category, updated_at)
      VALUES (${userId}, ${actName}, ${appearanceDate}, ${category}, NOW())
      ON CONFLICT (user_id, act_name, appearance_date) DO UPDATE
      SET category = EXCLUDED.category, updated_at = NOW()
    `;
  }

  return NextResponse.json({ ok: true });
}
