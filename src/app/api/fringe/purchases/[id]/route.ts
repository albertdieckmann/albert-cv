import { auth } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { buildGroupSession } from "@/lib/fringe-session";

async function resolveOwner(purchaseId: number, userId: string) {
  const row = await sql`
    SELECT buyer_user_id, group_id FROM fringe_purchases WHERE id = ${purchaseId}
  `;
  if (!row.rows.length) return { error: "Køb ikke fundet", status: 404, groupId: null };
  if (row.rows[0].buyer_user_id !== userId) return { error: "Ikke adgang", status: 403, groupId: null };
  return { error: null, status: null, groupId: row.rows[0].group_id as number };
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const { id } = await params;
  const purchaseId = parseInt(id, 10);
  if (!purchaseId) return NextResponse.json({ error: "Ugyldigt købs-id" }, { status: 400 });

  const { error, status, groupId } = await resolveOwner(purchaseId, userId);
  if (error) return NextResponse.json({ error }, { status: status! });

  await sql`DELETE FROM fringe_purchase_covers WHERE purchase_id = ${purchaseId}`;
  await sql`DELETE FROM fringe_purchases WHERE id = ${purchaseId}`;

  const activeGroup = await buildGroupSession(userId, groupId!);
  return NextResponse.json({ ok: true, activeGroup });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const { id } = await params;
  const purchaseId = parseInt(id, 10);
  if (!purchaseId) return NextResponse.json({ error: "Ugyldigt købs-id" }, { status: 400 });

  const { error, status, groupId } = await resolveOwner(purchaseId, userId);
  if (error) return NextResponse.json({ error }, { status: status! });

  const { totalCost, notes, coveredUserIds } = await req.json();

  await sql`
    UPDATE fringe_purchases
    SET total_cost = ${totalCost ?? null},
        notes      = ${notes ?? null}
    WHERE id = ${purchaseId}
  `;

  if (Array.isArray(coveredUserIds)) {
    const members = await sql`
      SELECT user_id, user_name FROM fringe_group_members WHERE group_id = ${groupId}
    `;
    const nameMap = Object.fromEntries(members.rows.map((m) => [m.user_id, m.user_name]));
    await sql`DELETE FROM fringe_purchase_covers WHERE purchase_id = ${purchaseId}`;
    for (const uid of coveredUserIds) {
      await sql`
        INSERT INTO fringe_purchase_covers (purchase_id, covered_user_id, covered_user_name)
        VALUES (${purchaseId}, ${uid}, ${nameMap[uid] ?? uid})
        ON CONFLICT DO NOTHING
      `;
    }
  }

  const activeGroup = await buildGroupSession(userId, groupId!);
  return NextResponse.json({ ok: true, activeGroup });
}
