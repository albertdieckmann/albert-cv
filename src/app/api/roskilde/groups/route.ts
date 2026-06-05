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
  const { groupName, displayName } = await req.json();
  if (!groupName?.trim()) return NextResponse.json({ error: "Gruppenavn mangler" }, { status: 400 });
  if (!displayName?.trim()) return NextResponse.json({ error: "Dit navn mangler" }, { status: 400 });

  const shareToken = randomToken(8);

  const groupResult = await sql`
    INSERT INTO roskilde_groups_v2 (name, share_token)
    VALUES (${groupName.trim()}, ${shareToken})
    RETURNING id
  `;
  const groupId = groupResult.rows[0].id;

  const recallCode = randomRecallCode();
  const memberResult = await sql`
    INSERT INTO roskilde_members (group_id, display_name, recall_code)
    VALUES (${groupId}, ${displayName.trim()}, ${recallCode})
    RETURNING member_id
  `;
  const memberId = memberResult.rows[0].member_id;

  return NextResponse.json({ memberId, groupId, shareToken, recallCode });
}
