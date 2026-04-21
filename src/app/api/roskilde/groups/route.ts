import { auth, currentUser } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Gruppenavn mangler" }, { status: 400 });

  const clerkUser = await currentUser();
  const displayName = clerkUser?.firstName
    ? `${clerkUser.firstName}${clerkUser.lastName ? ` ${clerkUser.lastName}` : ""}`.trim()
    : (clerkUser?.emailAddresses[0]?.emailAddress?.split("@")[0] ?? "Bruger");

  const groupResult = await sql`
    INSERT INTO roskilde_groups (name, created_by)
    VALUES (${name.trim()}, ${userId})
    RETURNING id
  `;
  const groupId = groupResult.rows[0].id;

  await sql`
    INSERT INTO roskilde_group_members (group_id, user_id, user_name, role)
    VALUES (${groupId}, ${userId}, ${displayName}, 'owner')
  `;

  return NextResponse.json({ groupId });
}
