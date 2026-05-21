import { auth } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const {
    groupId, showId, showTitle,
    performanceId, performanceStart,
    quantity, totalCost, notes, coveredUserIds,
  } = await req.json();

  if (!groupId || !showId) {
    return NextResponse.json({ error: "Manglende felter" }, { status: 400 });
  }
  if (!performanceId && !performanceStart) {
    return NextResponse.json({ error: "Vælg en forestilling." }, { status: 400 });
  }

  const memberCheck = await sql`
    SELECT user_name FROM fringe_group_members
    WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  if (!memberCheck.rows.length) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }

  const buyerName = memberCheck.rows[0].user_name;
  const perfId = performanceId ?? performanceStart;

  const purchaseResult = await sql`
    INSERT INTO fringe_purchases
      (group_id, buyer_user_id, buyer_user_name, show_id, show_title,
       performance_id, performance_start, quantity, total_cost, notes)
    VALUES
      (${groupId}, ${userId}, ${buyerName}, ${showId}, ${showTitle ?? ""},
       ${perfId}, ${performanceStart ?? null}, ${quantity ?? 1},
       ${totalCost ? parseFloat(totalCost) : null}, ${notes ?? null})
    RETURNING id
  `;
  const purchaseId = purchaseResult.rows[0].id;

  if (Array.isArray(coveredUserIds) && coveredUserIds.length > 0) {
    const allMembersResult = await sql`
      SELECT user_id, user_name FROM fringe_group_members WHERE group_id = ${groupId}
    `;
    const memberMap = new Map(allMembersResult.rows.map((m) => [m.user_id, m.user_name]));

    for (const coveredId of coveredUserIds) {
      const coveredName = memberMap.get(coveredId);
      if (!coveredName) continue;
      await sql`
        INSERT INTO fringe_purchase_covers (purchase_id, covered_user_id, covered_user_name)
        VALUES (${purchaseId}, ${coveredId}, ${coveredName})
        ON CONFLICT DO NOTHING
      `;
    }
  }

  return NextResponse.json({ ok: true, purchaseId });
}
