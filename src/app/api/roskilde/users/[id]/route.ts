import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

// PATCH: opdatér display_name — kun brugeren selv
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const requestUserId = req.headers.get("x-user-id");
  if (!requestUserId || requestUserId !== userId) {
    return NextResponse.json({ error: "Ikke tilladt" }, { status: 403 });
  }

  const { displayName } = await req.json();
  if (!displayName?.trim()) {
    return NextResponse.json({ error: "Navn mangler" }, { status: 400 });
  }

  await sql`
    UPDATE roskilde_users SET display_name = ${displayName.trim()} WHERE user_id = ${userId}
  `;

  return NextResponse.json({ ok: true });
}
