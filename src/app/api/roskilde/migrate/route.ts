import { auth } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const result = await sql`
    UPDATE roskilde_picks
    SET category = 'interested'
    WHERE category IN ('must', 'should', 'beer')
  `;

  return NextResponse.json({ ok: true, rowsUpdated: result.rowCount });
}
