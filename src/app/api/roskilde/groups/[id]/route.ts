import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

// DELETE: slet gruppe — kun det første medlem (opretteren) kan det
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  const memberId = req.headers.get("x-member-id");
  if (!memberId) return NextResponse.json({ error: "Mangler member-id" }, { status: 400 });

  // Tjek at memberId tilhører gruppen og er det ældste (opretteren)
  const ownerCheck = await sql`
    SELECT member_id FROM roskilde_members
    WHERE group_id = ${groupId}
    ORDER BY joined_at ASC
    LIMIT 1
  `;
  if (!ownerCheck.rows.length || ownerCheck.rows[0].member_id !== memberId) {
    return NextResponse.json({ error: "Kun opretteren kan slette gruppen" }, { status: 403 });
  }

  await sql`DELETE FROM roskilde_groups_v2 WHERE id = ${groupId}`;
  return NextResponse.json({ ok: true });
}
