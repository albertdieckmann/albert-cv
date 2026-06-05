import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

function randomRecallCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function POST(req: NextRequest) {
  const { shareToken, displayName } = await req.json();
  if (!shareToken?.trim()) return NextResponse.json({ error: "Share-token mangler" }, { status: 400 });
  if (!displayName?.trim()) return NextResponse.json({ error: "Dit navn mangler" }, { status: 400 });

  const groupResult = await sql`
    SELECT id, name FROM roskilde_groups_v2
    WHERE share_token = ${shareToken.trim().toUpperCase()}
  `;
  if (!groupResult.rows.length) {
    return NextResponse.json({ error: "Gruppen findes ikke — tjek token" }, { status: 404 });
  }

  const group = groupResult.rows[0];

  // Generer recall_code, prøv igen ved kollision
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
    INSERT INTO roskilde_members (group_id, display_name, recall_code)
    VALUES (${group.id}, ${displayName.trim()}, ${recallCode})
    RETURNING member_id
  `;
  const memberId = memberResult.rows[0].member_id;

  return NextResponse.json({ memberId, groupId: group.id, groupName: group.name, recallCode });
}
