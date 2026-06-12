import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { buildGroupList, buildGroupSession } from "@/app/fringe/lib/session";

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

  const groups = await buildGroupList(userId);

  const { searchParams } = new URL(req.url);
  const requestedId = searchParams.get("groupId") ? parseInt(searchParams.get("groupId")!, 10) : null;
  const activeGroupId =
    requestedId && groups.find((g) => g.id === requestedId)
      ? requestedId
      : (groups[0]?.id ?? null);

  const activeGroup = activeGroupId ? await buildGroupSession(userId, activeGroupId) : null;

  return NextResponse.json({ user, groups, activeGroup });
}
