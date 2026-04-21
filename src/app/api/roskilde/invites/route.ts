import { auth } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const { groupId } = await req.json();
  if (!groupId) return NextResponse.json({ error: "Gruppe-id mangler" }, { status: 400 });

  const memberCheck = await sql`
    SELECT 1 FROM roskilde_group_members
    WHERE group_id = ${groupId} AND user_id = ${userId}
  `;
  if (!memberCheck.rows.length) return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });

  const code = generateCode();
  await sql`
    INSERT INTO roskilde_invites (code, group_id)
    VALUES (${code}, ${groupId})
  `;

  return NextResponse.json({ code });
}
