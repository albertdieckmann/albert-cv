// GET  /api/roskilde/g/[token]/places  — list gruppens steder
// POST /api/roskilde/g/[token]/places  — opret nyt sted
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";
import { resolveGroupMember } from "../../_auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await resolveGroupMember(req, token);
  if ("error" in result) return result.error;
  const { groupId } = result.ctx;

  const rows = await sql`
    SELECT id, name, emoji, created_by, created_at
    FROM rf_group_places
    WHERE group_id = ${groupId}
    ORDER BY created_at ASC
  `;

  return NextResponse.json({ places: rows.rows });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await resolveGroupMember(req, token);
  if ("error" in result) return result.error;
  const { groupId, memberId } = result.ctx;

  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").trim().slice(0, 80);
  const emoji = (body.emoji ?? "").trim().slice(0, 4) || null;

  if (!name) {
    return NextResponse.json({ error: "name påkrævet" }, { status: 400 });
  }

  const row = await sql`
    INSERT INTO rf_group_places (group_id, name, emoji, created_by)
    VALUES (${groupId}, ${name}, ${emoji}, ${memberId})
    RETURNING id, name, emoji, created_by, created_at
  `;

  return NextResponse.json({ place: row.rows[0] }, { status: 201 });
}
