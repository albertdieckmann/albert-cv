import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

// GET /api/roskilde/resume?groupId=<uuid>&code=<4cifre>
// Finder member_id fra recall_code så brugeren kan genvinde adgang
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  const code = searchParams.get("code");

  if (!groupId || !code) {
    return NextResponse.json({ error: "Mangler groupId eller code" }, { status: 400 });
  }

  const result = await sql`
    SELECT member_id, display_name
    FROM roskilde_members
    WHERE group_id = ${groupId} AND recall_code = ${code}
  `;

  if (!result.rows.length) {
    return NextResponse.json({ error: "Koden passer ikke til nogen i gruppen" }, { status: 404 });
  }

  return NextResponse.json({
    memberId: result.rows[0].member_id,
    displayName: result.rows[0].display_name,
  });
}
