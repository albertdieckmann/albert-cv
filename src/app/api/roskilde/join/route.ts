import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

function randomRecallCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function POST(req: NextRequest) {
  const { shareToken, displayName, userId: existingUserId } = await req.json();
  if (!shareToken?.trim()) return NextResponse.json({ error: "Share-token mangler" }, { status: 400 });

  const groupResult = await sql`
    SELECT id, name FROM roskilde_groups_v2
    WHERE share_token = ${shareToken.trim().toUpperCase()}
  `;
  if (!groupResult.rows.length) {
    return NextResponse.json({ error: "Gruppen findes ikke — tjek token" }, { status: 404 });
  }
  const group = groupResult.rows[0];

  let userId = existingUserId?.trim() ?? null;

  if (!userId) {
    if (!displayName?.trim()) return NextResponse.json({ error: "Dit navn mangler" }, { status: 400 });
    const userResult = await sql`
      INSERT INTO roskilde_users (display_name)
      VALUES (${displayName.trim()})
      RETURNING user_id
    `;
    userId = userResult.rows[0].user_id;
  } else {
    const check = await sql`SELECT user_id FROM roskilde_users WHERE user_id = ${userId}`;
    if (!check.rows.length) return NextResponse.json({ error: "Ukendt bruger-ID" }, { status: 404 });

    // Tjek om allerede med i gruppen
    const existing = await sql`
      SELECT member_id FROM roskilde_members WHERE user_id = ${userId} AND group_id = ${group.id}
    `;
    if (existing.rows.length) {
      return NextResponse.json({ error: "Du er allerede med i denne gruppe" }, { status: 409 });
    }
  }

  let recallCode = randomRecallCode();
  let attempts = 0;
  while (attempts < 10) {
    const collision = await sql`
      SELECT 1 FROM roskilde_members WHERE group_id = ${group.id} AND recall_code = ${recallCode}
    `;
    if (!collision.rows.length) break;
    recallCode = randomRecallCode();
    attempts++;
  }

  const memberResult = await sql`
    INSERT INTO roskilde_members (user_id, group_id, recall_code)
    VALUES (${userId}, ${group.id}, ${recallCode})
    RETURNING member_id
  `;
  const memberId = memberResult.rows[0].member_id;

  return NextResponse.json({ userId, memberId, groupId: group.id, groupName: group.name, recallCode });
}
