import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

// GET /api/roskilde/resume?groupId=<uuid>&code=<4cifre>
// Finder userId fra recall_code på et specifikt gruppemedlemskab
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const groupId = searchParams.get("groupId");
  const code = searchParams.get("code");

  if (!groupId || !code) {
    return NextResponse.json({ error: "Mangler groupId eller code" }, { status: 400 });
  }

  const result = await sql`
    SELECT m.user_id, u.display_name
    FROM roskilde_members m
    JOIN roskilde_users u ON u.user_id = m.user_id
    WHERE m.group_id = ${groupId} AND m.recall_code = ${code}
  `;

  if (!result.rows.length) {
    return NextResponse.json({ error: "Koden passer ikke til nogen i gruppen" }, { status: 404 });
  }

  return NextResponse.json({
    userId: result.rows[0].user_id,
    displayName: result.rows[0].display_name,
  });
}
