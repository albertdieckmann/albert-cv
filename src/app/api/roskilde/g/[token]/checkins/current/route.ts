// DELETE /api/roskilde/g/[token]/checkins/current
// Manuel udtjekning — lukker aktiv check-in for dette medlem.
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { resolveGroupMember } from "../../../_auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await resolveGroupMember(req, token);
  if ("error" in result) return result.error;
  const { groupId, memberId } = result.ctx;

  await sql`
    UPDATE rf_checkins
    SET checked_out_at = NOW()
    WHERE member_id = ${memberId}
      AND checked_out_at IS NULL
      AND expires_at > NOW()
  `;

  // Returnér version til klienten
  const vRow = await sql`
    SELECT MAX(GREATEST(checked_in_at, COALESCE(checked_out_at, checked_in_at))) AS version
    FROM rf_checkins WHERE group_id = ${groupId}
  `;

  return NextResponse.json({
    ok: true,
    version: vRow.rows[0]?.version ?? new Date(0).toISOString(),
  });
}
