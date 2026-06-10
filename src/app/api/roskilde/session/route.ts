import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ user: null, groups: [] });
  }

  const userResult = await sql`
    SELECT user_id, display_name FROM roskilde_users WHERE user_id = ${userId}
  `;

  if (!userResult.rows.length) {
    return NextResponse.json({ user: null, groups: [] });
  }

  const userRow = userResult.rows[0];

  // Hent alle grupper brugeren er med i
  const membershipsResult = await sql`
    SELECT m.member_id, m.recall_code, m.joined_at,
           g.id AS group_id, g.name AS group_name, g.share_token
    FROM roskilde_members m
    JOIN roskilde_groups_v2 g ON g.id = m.group_id
    WHERE m.user_id = ${userId}
    ORDER BY m.joined_at ASC
  `;

  const groups = await Promise.all(
    membershipsResult.rows.map(async (row) => {
      const [membersResult, picksResult] = await Promise.all([
        sql`
          SELECT m.member_id, m.user_id, u.display_name, m.joined_at
          FROM roskilde_members m
          JOIN roskilde_users u ON u.user_id = m.user_id
          WHERE m.group_id = ${row.group_id}
          ORDER BY m.joined_at ASC
        `,
        sql`
          SELECT p.user_id, u.display_name, p.act_name, p.appearance_date, p.category
          FROM roskilde_picks_v3 p
          JOIN roskilde_users u ON u.user_id = p.user_id
          WHERE p.user_id IN (
            SELECT user_id FROM roskilde_members WHERE group_id = ${row.group_id}
          )
          ORDER BY p.updated_at DESC
        `,
      ]);

      return {
        id: row.group_id,
        name: row.group_name,
        shareToken: row.share_token,
        memberId: row.member_id,
        recallCode: row.recall_code,
        members: membersResult.rows.map((m) => ({
          memberId: m.member_id,
          userId: m.user_id,
          displayName: m.display_name,
        })),
        picks: picksResult.rows.map((p) => ({
          userId: p.user_id,
          displayName: p.display_name,
          actName: p.act_name,
          appearanceDate: p.appearance_date,
          category: p.category,
        })),
      };
    })
  );

  return NextResponse.json({
    user: {
      userId: userRow.user_id,
      displayName: userRow.display_name,
    },
    groups,
  });
}
