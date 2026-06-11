// POST /api/roskilde/g/[token]/checkins
// Lukker evt. aktiv check-in og opretter ny; returnerer presence-snapshot.
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { resolveGroupMember } from "../../_auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await resolveGroupMember(req, token);
  if ("error" in result) return result.error;
  const { groupId, memberId } = result.ctx;

  const body = await req.json().catch(() => ({}));
  const { targetType, performanceId, placeId } = body as {
    targetType?: string;
    performanceId?: string;
    placeId?: string;
  };

  if (targetType !== "performance" && targetType !== "place") {
    return NextResponse.json({ error: "targetType skal være 'performance' eller 'place'" }, { status: 400 });
  }
  if (targetType === "performance" && !performanceId) {
    return NextResponse.json({ error: "performanceId påkrævet" }, { status: 400 });
  }
  if (targetType === "place" && !placeId) {
    return NextResponse.json({ error: "placeId påkrævet" }, { status: 400 });
  }

  if (targetType === "place") {
    const pCheck = await sql`
      SELECT id FROM rf_group_places WHERE id = ${placeId!} AND group_id = ${groupId}
    `;
    if (!pCheck.rows[0]) {
      return NextResponse.json({ error: "Sted ikke fundet i gruppen" }, { status: 404 });
    }
  }

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  // Luk aktive check-ins for dette medlem i samme transaktion
  await sql`BEGIN`;
  try {
    await sql`
      UPDATE rf_checkins
      SET checked_out_at = NOW()
      WHERE member_id = ${memberId}
        AND checked_out_at IS NULL
        AND expires_at > NOW()
    `;

    if (targetType === "performance") {
      await sql`
        INSERT INTO rf_checkins (group_id, member_id, target_type, performance_id, expires_at)
        VALUES (${groupId}, ${memberId}, 'performance', ${performanceId!}, ${expiresAt})
      `;
    } else {
      await sql`
        INSERT INTO rf_checkins (group_id, member_id, target_type, place_id, expires_at)
        VALUES (${groupId}, ${memberId}, 'place', ${placeId!}, ${expiresAt})
      `;
    }

    await sql`COMMIT`;
  } catch (err) {
    await sql`ROLLBACK`;
    console.error("checkin fejl:", err);
    return NextResponse.json({ error: "Databasefejl" }, { status: 500 });
  }

  // Returnér presence-snapshot via intern redirect-lignende approach
  return presenceSnapshot(groupId, result.ctx.userId);
}

async function presenceSnapshot(groupId: string, userId: string): Promise<NextResponse> {
  const vRow = await sql`
    SELECT MAX(GREATEST(checked_in_at, COALESCE(checked_out_at, checked_in_at))) AS version
    FROM rf_checkins WHERE group_id = ${groupId}
  `;
  const version: string = vRow.rows[0]?.version ?? new Date(0).toISOString();

  const rows = await sql`
    SELECT
      c.target_type, c.performance_id, c.place_id,
      c.checked_in_at, c.expires_at,
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

  type Entry = { type: string; performanceId?: string; placeId?: string; members: object[] };
  const targetMap = new Map<string, Entry>();
  let myActive: object | null = null;

  for (const row of rows.rows) {
    const key =
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
    version,
    targets: [...targetMap.values()],
    me: { active: myActive },
  });
}
