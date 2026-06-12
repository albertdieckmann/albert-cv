import { auth } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { buildGroupSession } from "@/app/fringe/lib/session";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const { groupId, showId, showTitle, status, performanceId, performanceStart, performanceEnd } =
    await req.json();

  if (!groupId || !showId) {
    return NextResponse.json({ error: "Manglende felter" }, { status: 400 });
  }

  // Require a performance for going/has_ticket
  if (status === "going" || status === "has_ticket") {
    if (!performanceId && !performanceStart) {
      return NextResponse.json(
        { error: "Vælg en forestilling for denne status." },
        { status: 400 },
      );
    }
  }

  const memberCheck = await sql`
    SELECT user_name FROM fringe_group_members
    WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  if (!memberCheck.rows.length) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const userName = memberCheck.rows[0].user_name;
  // performance_id takes precedence; fall back to performanceStart as text key
  const perfId = performanceId ?? performanceStart ?? null;

  if (!status) {
    await sql`
      DELETE FROM fringe_picks
      WHERE group_id = ${groupId} AND user_id = ${userId} AND show_id = ${showId}
    `;
  } else {
    await sql`
      INSERT INTO fringe_picks
        (group_id, user_id, user_name, show_id, show_title, status,
         performance_id, performance_start, performance_end, updated_at)
      VALUES
        (${groupId}, ${userId}, ${userName}, ${showId}, ${showTitle ?? ""}, ${status},
         ${perfId}, ${performanceStart ?? null}, ${performanceEnd ?? null}, NOW())
      ON CONFLICT (group_id, user_id, show_id) DO UPDATE
        SET status            = EXCLUDED.status,
            show_title        = EXCLUDED.show_title,
            user_name         = EXCLUDED.user_name,
            performance_id    = EXCLUDED.performance_id,
            performance_start = EXCLUDED.performance_start,
            performance_end   = EXCLUDED.performance_end,
            updated_at        = NOW()
    `;
  }

  const activeGroup = await buildGroupSession(userId, groupId);
  return NextResponse.json({ ok: true, groupId, activeGroup });
}
