import { auth } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const { id } = await params;
  const groupId = parseInt(id, 10);
  if (!groupId) return NextResponse.json({ error: "Ugyldigt gruppe-id" }, { status: 400 });

  const ownerCheck = await sql`
    SELECT 1 FROM fringe_groups
    WHERE id = ${groupId} AND created_by = ${userId}
  `;
  if (!ownerCheck.rows.length) {
    return NextResponse.json(
      { error: "Kun den der oprettede gruppen kan slette den" },
      { status: 403 }
    );
  }

  await sql`DELETE FROM fringe_picks WHERE group_id = ${groupId}`;
  await sql`DELETE FROM fringe_purchases WHERE group_id = ${groupId}`;
  await sql`DELETE FROM fringe_groups WHERE id = ${groupId}`;

  return NextResponse.json({ ok: true });
}
