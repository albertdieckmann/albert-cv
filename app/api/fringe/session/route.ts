import { auth, currentUser } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ user: null, groups: [], activeGroup: null });
  }

  const clerkUser = await currentUser();
  const displayName = clerkUser?.firstName
    ? `${clerkUser.firstName}${clerkUser.lastName ? ` ${clerkUser.lastName}` : ""}`.trim()
    : (clerkUser?.emailAddresses[0]?.emailAddress?.split("@")[0] ?? "Bruger");

  const user = {
    id: userId,
    name: displayName,
    email: clerkUser?.emailAddresses[0]?.emailAddress ?? "",
  };

  const groupsResult = await sql`
    SELECT g.id, g.name, g.start_date, g.end_date
    FROM fringe_groups g
    JOIN fringe_group_members m ON g.id = m.group_id
    WHERE m.user_id = ${userId}
    ORDER BY g.id ASC
  `;
  const groups = groupsResult.rows;

  const { searchParams } = new URL(req.url);
  const requestedId = searchParams.get("groupId")
    ? parseInt(searchParams.get("groupId")!, 10)
    : null;
  const activeGroupId =
    requestedId && groups.find((g) => g.id === requestedId)
      ? requestedId
      : (groups[0]?.id ?? null);

  let activeGroup = null;
  if (activeGroupId) {
    const [membersResult, invitesResult, picksResult, purchasesResult, coversResult] =
      await Promise.all([
        sql`
          SELECT user_id as id, user_name as name, role
          FROM fringe_group_members
          WHERE group_id = ${activeGroupId}
          ORDER BY joined_at ASC
        `,
        sql`
          SELECT code
          FROM fringe_invites
          WHERE group_id = ${activeGroupId} AND used_by IS NULL
          ORDER BY created_at DESC
          LIMIT 5
        `,
        sql`
          SELECT user_id, user_name, show_id, show_title, status,
                 performance_id, performance_start, performance_end
          FROM fringe_picks
          WHERE group_id = ${activeGroupId}
          ORDER BY updated_at DESC
        `,
        sql`
          SELECT id, buyer_user_id, buyer_user_name, show_id, show_title,
                 performance_id, performance_start, quantity, total_cost, notes, purchased_at
          FROM fringe_purchases
          WHERE group_id = ${activeGroupId}
          ORDER BY purchased_at DESC
        `,
        sql`
          SELECT pc.purchase_id, pc.covered_user_id, pc.covered_user_name,
                 pc.settled, pc.settled_at
          FROM fringe_purchase_covers pc
          JOIN fringe_purchases p ON p.id = pc.purchase_id
          WHERE p.group_id = ${activeGroupId}
        `,
      ]);

    const coversByPurchase = new Map<number, typeof coversResult.rows>();
    for (const cover of coversResult.rows) {
      const list = coversByPurchase.get(cover.purchase_id) ?? [];
      list.push(cover);
      coversByPurchase.set(cover.purchase_id, list);
    }

    const purchases = purchasesResult.rows.map((p) => ({
      ...p,
      covers: coversByPurchase.get(p.id) ?? [],
    }));

    const activeGroupMeta = groups.find((g) => g.id === activeGroupId)!;
    activeGroup = {
      id: activeGroupId,
      name: activeGroupMeta.name,
      startDate: activeGroupMeta.start_date ?? null,
      endDate: activeGroupMeta.end_date ?? null,
      members: membersResult.rows,
      invites: invitesResult.rows,
      picks: picksResult.rows,
      purchases,
    };
  }

  return NextResponse.json({ user, groups, activeGroup });
}
