// Shared auth helper for /api/roskilde/g/[token]/* routes.
// Resolves share_token → group, x-user-id → member.
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export type GroupMemberCtx = { groupId: string; memberId: string; userId: string };

export async function resolveGroupMember(
  req: NextRequest,
  token: string
): Promise<{ ctx: GroupMemberCtx } | { error: NextResponse }> {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return { error: NextResponse.json({ error: "x-user-id påkrævet" }, { status: 401 }) };
  }

  const g = await sql`
    SELECT id FROM roskilde_groups_v2 WHERE share_token = ${token}
  `;
  if (!g.rows[0]) {
    return { error: NextResponse.json({ error: "Gruppe ikke fundet" }, { status: 404 }) };
  }
  const groupId = g.rows[0].id as string;

  const m = await sql`
    SELECT member_id FROM roskilde_members
    WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  if (!m.rows[0]) {
    return { error: NextResponse.json({ error: "Ikke medlem af gruppen" }, { status: 403 }) };
  }

  return { ctx: { groupId, memberId: m.rows[0].member_id as string, userId } };
}
