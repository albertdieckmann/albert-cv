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
    SELECT g.id, g.name
    FROM roskilde_groups g
    JOIN roskilde_group_members m ON g.id = m.group_id
    WHERE m.user_id = ${userId}
    ORDER BY g.id ASC
  `;
  const groups = groupsResult.rows;

  const { searchParams } = new URL(req.url);
  const requestedId = searchParams.get("groupId") ? parseInt(searchParams.get("groupId")!, 10) : null;
  const activeGroupId =
    requestedId && groups.find((g) => g.id === requestedId)
      ? requestedId
      : (groups[0]?.id ?? null);

  let activeGroup = null;
  if (activeGroupId) {
    const [membersResult, invitesResult, picksResult] = await Promise.all([
      sql`
        SELECT user_id as id, user_name as name, role
        FROM roskilde_group_members
        WHERE group_id = ${activeGroupId}
        ORDER BY joined_at ASC
      `,
      sql`
        SELECT code
        FROM roskilde_invites
        WHERE group_id = ${activeGroupId} AND used_by IS NULL
        ORDER BY created_at DESC
        LIMIT 5
      `,
      sql`
        SELECT user_id, user_name, act_name, category
        FROM roskilde_picks
        WHERE group_id = ${activeGroupId}
        ORDER BY updated_at DESC
      `,
    ]);

    activeGroup = {
      id: activeGroupId,
      name: groups.find((g) => g.id === activeGroupId)?.name ?? "",
      members: membersResult.rows,
      invites: invitesResult.rows,
      picks: picksResult.rows,
    };
  }

  return NextResponse.json({ user, groups, activeGroup });
}
