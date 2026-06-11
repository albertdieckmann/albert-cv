// GET /api/roskilde/g/[token]/presence
// ?since=ISO_TS → 304 hvis intet er ændret siden 'since'
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { resolveGroupMember } from "../../_auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await resolveGroupMember(req, token);
  if ("error" in result) return result.error;
  const { groupId, userId } = result.ctx;

  // Beregn version = nyeste event-timestamp i gruppen
  const vRow = await sql`
    SELECT MAX(GREATEST(checked_in_at, COALESCE(checked_out_at, checked_in_at))) AS version
    FROM rf_checkins
    WHERE group_id = ${groupId}
  `;
  const version: string | null = vRow.rows[0]?.version ?? null;

  const since = req.nextUrl.searchParams.get("since");
  if (since && version && version <= since) {
    return new NextResponse(null, { status: 304 });
  }

  // Aktive check-ins
  const rows = await sql`
    SELECT
      c.id, c.target_type, c.performance_id, c.place_id,
      c.checked_in_at, c.expires_at,
      c.member_id,
      u.display_name AS member_name,
      m.user_id
    FROM rf_checkins c
    JOIN roskilde_members m ON c.member_id = m.member_id
    JOIN roskilde_users u ON m.user_id = u.user_id
    WHERE c.group_id = ${groupId}
      AND c.checked_out_at IS NULL
      AND c.expires_at > NOW()
    ORDER BY c.checked_in_at ASC
  `;

  // Gruppér pr. target
  type TargetKey = string;
  const targetMap = new Map<
    TargetKey,
    { type: string; performanceId?: string; placeId?: string; members: object[] }
  >();

  let myActive: object | null = null;

  for (const row of rows.rows) {
    const key: TargetKey =
      row.target_type === "performance"
        ? `perf::${row.performance_id}`
        : `place::${row.place_id}`;

    if (!targetMap.has(key)) {
      targetMap.set(key, {
        type: row.target_type,
        ...(row.target_type === "performance"
          ? { performanceId: row.performance_id }
          : { placeId: row.place_id }),
        members: [],
      });
    }

    targetMap.get(key)!.members.push({
      name: row.member_name,
      checkedInAt: row.checked_in_at,
      expiresAt: row.expires_at,
    });

    if (row.user_id === userId) {
      myActive =
        row.target_type === "performance"
          ? { targetType: "performance", performanceId: row.performance_id }
          : { targetType: "place", placeId: row.place_id };
    }
  }

  return NextResponse.json({
    version: version ?? new Date(0).toISOString(),
    targets: [...targetMap.values()],
    me: { active: myActive },
  });
}
