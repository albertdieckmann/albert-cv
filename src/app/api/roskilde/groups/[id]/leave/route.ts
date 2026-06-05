import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  const memberId = req.headers.get("x-member-id");
  if (!memberId) return NextResponse.json({ error: "Mangler member-id" }, { status: 400 });

  // Opretteren (ældste) kan ikke bare forlade — de skal slette
  const ownerCheck = await sql`
    SELECT member_id FROM roskilde_members
    WHERE group_id = ${groupId}
    ORDER BY joined_at ASC
    LIMIT 1
  `;
  if (ownerCheck.rows[0]?.member_id === memberId) {
    return NextResponse.json(
      { error: "Du oprettede gruppen — slet den i stedet for at forlade den" },
      { status: 403 }
    );
  }

  // Picks slettes via CASCADE (member_id FK)
  await sql`DELETE FROM roskilde_members WHERE member_id = ${memberId} AND group_id = ${groupId}`;
  return NextResponse.json({ ok: true });
}
