import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

// PATCH: omdøb gruppe — kun opretteren kan det
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Mangler user-id" }, { status: 400 });

  const ownerCheck = await sql`
    SELECT user_id FROM roskilde_members
    WHERE group_id = ${groupId}
    ORDER BY joined_at ASC
    LIMIT 1
  `;
  if (!ownerCheck.rows.length || ownerCheck.rows[0].user_id !== userId) {
    return NextResponse.json({ error: "Kun opretteren kan omdøbe gruppen" }, { status: 403 });
  }

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Navn mangler" }, { status: 400 });

  await sql`UPDATE roskilde_groups_v2 SET name = ${name.trim()} WHERE id = ${groupId}`;
  return NextResponse.json({ ok: true });
}

// DELETE: slet gruppe — kun opretteren (ældste member) kan det
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Mangler user-id" }, { status: 400 });

  const ownerCheck = await sql`
    SELECT user_id FROM roskilde_members
    WHERE group_id = ${groupId}
    ORDER BY joined_at ASC
    LIMIT 1
  `;
  if (!ownerCheck.rows.length || ownerCheck.rows[0].user_id !== userId) {
    return NextResponse.json({ error: "Kun opretteren kan slette gruppen" }, { status: 403 });
  }

  await sql`DELETE FROM roskilde_groups_v2 WHERE id = ${groupId}`;
  return NextResponse.json({ ok: true });
}
