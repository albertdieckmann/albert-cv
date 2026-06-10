import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

function randomToken(len: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function randomRecallCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function POST(req: NextRequest) {
  const { groupName, displayName, userId: existingUserId } = await req.json();
  if (!groupName?.trim()) return NextResponse.json({ error: "Gruppenavn mangler" }, { status: 400 });

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
    // Verificér at userId findes
    const check = await sql`SELECT user_id FROM roskilde_users WHERE user_id = ${userId}`;
    if (!check.rows.length) return NextResponse.json({ error: "Ukendt bruger-ID" }, { status: 404 });
  }

  const shareToken = randomToken(8);
  const groupResult = await sql`
    INSERT INTO roskilde_groups_v2 (name, share_token)
    VALUES (${groupName.trim()}, ${shareToken})
    RETURNING id
  `;
  const groupId = groupResult.rows[0].id;

  const recallCode = randomRecallCode();
  const memberResult = await sql`
    INSERT INTO roskilde_members (user_id, group_id, recall_code)
    VALUES (${userId}, ${groupId}, ${recallCode})
    RETURNING member_id
  `;
  const memberId = memberResult.rows[0].member_id;

  return NextResponse.json({ userId, memberId, groupId, shareToken, recallCode });
}
