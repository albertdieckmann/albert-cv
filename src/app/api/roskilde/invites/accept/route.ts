import { NextResponse } from "next/server";

// Udgået — brug /api/roskilde/join med shareToken.
export async function POST() {
  return NextResponse.json({ error: "Udgået — brug /api/roskilde/join" }, { status: 410 });
}
