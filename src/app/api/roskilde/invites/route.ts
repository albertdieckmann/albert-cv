import { NextResponse } from "next/server";

// Udgået — grupper joinnes nu via share_token (/api/roskilde/join).
export async function POST() {
  return NextResponse.json({ error: "Udgået — brug /api/roskilde/join" }, { status: 410 });
}
