import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Mangler user-id" }, { status: 400 });

  // Opretteren (ældste) kan ikke bare forlade — de skal slette
  const ownerCheck = await sql`
    SELECT user_id FROM roskilde_members
    WHERE group_id = ${groupId}
    ORDER BY joined_at ASC
    LIMIT 1
  `;
  if (ownerCheck.rows[0]?.user_id === userId) {
    return NextResponse.json(
      { error: "Du oprettede gruppen — slet den i stedet for at forlade den" },
      { status: 403 }
    );
  }

  // Picks er user-level og forbliver intakte ved udtræden
  await sql`DELETE FROM roskilde_members WHERE user_id = ${userId} AND group_id = ${groupId}`;
  return NextResponse.json({ ok: true });
}
