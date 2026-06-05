import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

const VALID_CATEGORIES = ["interested", "going", "has_ticket"];

export async function POST(req: NextRequest) {
  const memberId = req.headers.get("x-member-id");
  if (!memberId) return NextResponse.json({ error: "Mangler member-id" }, { status: 400 });

  const { actName, category } = await req.json();
  if (!actName) return NextResponse.json({ error: "Manglende actName" }, { status: 400 });
  if (category && !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Ugyldig kategori" }, { status: 400 });
  }

  const memberCheck = await sql`
    SELECT group_id FROM roskilde_members WHERE member_id = ${memberId}
  `;
  if (!memberCheck.rows.length) return NextResponse.json({ error: "Ukendt member" }, { status: 403 });

  const groupId = memberCheck.rows[0].group_id;

  if (!category) {
    await sql`
      DELETE FROM roskilde_picks_v2
      WHERE member_id = ${memberId} AND act_name = ${actName}
    `;
  } else {
    await sql`
      INSERT INTO roskilde_picks_v2 (member_id, group_id, act_name, category, updated_at)
      VALUES (${memberId}, ${groupId}, ${actName}, ${category}, NOW())
      ON CONFLICT (member_id, act_name) DO UPDATE
      SET category = EXCLUDED.category, updated_at = NOW()
    `;
  }

  return NextResponse.json({ ok: true });
}
