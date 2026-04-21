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

  // Ejeren kan ikke forlade — de skal slette gruppen i stedet
  const ownerCheck = await sql`
    SELECT 1 FROM roskilde_groups
    WHERE id = ${groupId} AND created_by = ${userId}
  `;
  if (ownerCheck.rows.length) {
    return NextResponse.json(
      { error: "Du oprettede gruppen — slet den i stedet for at forlade den" },
      { status: 403 }
    );
  }

  await sql`DELETE FROM roskilde_picks WHERE group_id = ${groupId} AND user_id = ${userId}`;
  await sql`DELETE FROM roskilde_group_members WHERE group_id = ${groupId} AND user_id = ${userId}`;

  return NextResponse.json({ ok: true });
}
