import { auth } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { buildGroupSession } from "@/app/fringe/lib/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const { id } = await params;
  const purchaseId = parseInt(id, 10);
  if (!purchaseId) return NextResponse.json({ error: "Ugyldigt købs-id" }, { status: 400 });

  const { coveredUserId, settled } = await req.json();
  if (!coveredUserId) return NextResponse.json({ error: "Manglende felter" }, { status: 400 });

  // Verify caller is in the same group as the purchase
  const accessCheck = await sql`
    SELECT p.group_id FROM fringe_purchases p
    JOIN fringe_group_members m ON m.group_id = p.group_id
    WHERE p.id = ${purchaseId} AND m.user_id = ${userId}
  `;
  if (!accessCheck.rows.length) {
    return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  }
  const groupId: number = accessCheck.rows[0].group_id;

  const isSettled = settled !== false;

  if (isSettled) {
    await sql`
      UPDATE fringe_purchase_covers
      SET settled = true, settled_at = NOW()
      WHERE purchase_id = ${purchaseId} AND covered_user_id = ${coveredUserId}
    `;
  } else {
    await sql`
      UPDATE fringe_purchase_covers
      SET settled = false, settled_at = NULL
      WHERE purchase_id = ${purchaseId} AND covered_user_id = ${coveredUserId}
    `;
  }

  const activeGroup = await buildGroupSession(userId, groupId);
  return NextResponse.json({ ok: true, activeGroup });
}
