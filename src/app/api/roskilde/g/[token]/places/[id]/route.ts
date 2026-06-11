// DELETE /api/roskilde/g/[token]/places/[id]
// Kun den der oprettede stedet (eller gruppen er tom for steder) kan slette.
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { resolveGroupMember } from "../../../_auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  const result = await resolveGroupMember(req, token);
  if ("error" in result) return result.error;
  const { groupId, memberId } = result.ctx;

  const place = await sql`
    SELECT id, created_by FROM rf_group_places
    WHERE id = ${id} AND group_id = ${groupId}
  `;
  if (!place.rows[0]) {
    return NextResponse.json({ error: "Sted ikke fundet" }, { status: 404 });
  }

  // Kun opretteren må slette
  if (place.rows[0].created_by !== memberId) {
    return NextResponse.json({ error: "Kun opretteren kan slette stedet" }, { status: 403 });
  }

  await sql`DELETE FROM rf_group_places WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
