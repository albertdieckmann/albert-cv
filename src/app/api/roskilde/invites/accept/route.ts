import { auth, currentUser } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const { code } = await req.json();
  if (!code?.trim()) return NextResponse.json({ error: "Invite-kode mangler" }, { status: 400 });

  const inviteResult = await sql`
    SELECT id, group_id FROM roskilde_invites
    WHERE code = ${code.trim().toUpperCase()} AND used_by IS NULL
  `;
  if (!inviteResult.rows.length) {
    return NextResponse.json({ error: "Ugyldig eller allerede brugt kode" }, { status: 400 });
  }

  const { id: inviteId, group_id: groupId } = inviteResult.rows[0];

  const clerkUser = await currentUser();
  const displayName = clerkUser?.firstName
    ? `${clerkUser.firstName}${clerkUser.lastName ? ` ${clerkUser.lastName}` : ""}`.trim()
    : (clerkUser?.emailAddresses[0]?.emailAddress?.split("@")[0] ?? "Bruger");

  await sql`
    INSERT INTO roskilde_group_members (group_id, user_id, user_name, role)
    VALUES (${groupId}, ${userId}, ${displayName}, 'member')
    ON CONFLICT (group_id, user_id) DO NOTHING
  `;

  await sql`
    UPDATE roskilde_invites
    SET used_by = ${userId}, used_at = NOW()
    WHERE id = ${inviteId}
  `;

  return NextResponse.json({ ok: true, groupId });
}
