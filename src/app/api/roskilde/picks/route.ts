import { auth } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const { groupId, actName, category } = await req.json();
  if (!groupId || !actName) return NextResponse.json({ error: "Manglende felter" }, { status: 400 });

  const memberCheck = await sql`
    SELECT user_name FROM roskilde_group_members
    WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  if (!memberCheck.rows.length) return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });

  const userName = memberCheck.rows[0].user_name;

  if (!category) {
    await sql`
      DELETE FROM roskilde_picks
      WHERE group_id = ${groupId} AND user_id = ${userId} AND act_name = ${actName}
    `;
  } else {
    await sql`
      INSERT INTO roskilde_picks (group_id, user_id, user_name, act_name, category, updated_at)
      VALUES (${groupId}, ${userId}, ${userName}, ${actName}, ${category}, NOW())
      ON CONFLICT (group_id, user_id, act_name) DO UPDATE
      SET category = EXCLUDED.category, user_name = EXCLUDED.user_name, updated_at = NOW()
    `;
  }

  return NextResponse.json({ ok: true });
}
