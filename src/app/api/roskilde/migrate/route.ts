import { NextResponse } from "next/server";

// Denne route er udgået (v1 migration, Clerk-baseret).
export async function POST() {
  return NextResponse.json({ error: "Udgået" }, { status: 410 });
}
