import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get("memberId");

  if (!memberId) {
    return NextResponse.json({ member: null, group: null });
  }

  const memberResult = await sql`
    SELECT m.member_id, m.display_name, m.recall_code, m.joined_at,
           g.id AS group_id, g.name AS group_name, g.share_token
    FROM roskilde_members m
    JOIN roskilde_groups_v2 g ON g.id = m.group_id
    WHERE m.member_id = ${memberId}
  `;

  if (!memberResult.rows.length) {
    return NextResponse.json({ member: null, group: null });
  }

  const row = memberResult.rows[0];

  const [membersResult, picksResult] = await Promise.all([
    sql`
      SELECT member_id, display_name, joined_at
      FROM roskilde_members
      WHERE group_id = ${row.group_id}
      ORDER BY joined_at ASC
    `,
    sql`
      SELECT p.member_id, m.display_name, p.act_name, p.appearance_date, p.category
      FROM roskilde_picks_v2 p
      JOIN roskilde_members m ON m.member_id = p.member_id
      WHERE p.group_id = ${row.group_id}
      ORDER BY p.updated_at DESC
    `,
  ]);

  return NextResponse.json({
    member: {
      memberId: row.member_id,
      displayName: row.display_name,
      recallCode: row.recall_code,
    },
    group: {
      id: row.group_id,
      name: row.group_name,
      shareToken: row.share_token,
      members: membersResult.rows.map((m) => ({
        memberId: m.member_id,
        displayName: m.display_name,
      })),
      picks: picksResult.rows.map((p) => ({
        memberId: p.member_id,
        displayName: p.display_name,
        actName: p.act_name,
        appearanceDate: p.appearance_date,
        category: p.category,
      })),
    },
  });
}
