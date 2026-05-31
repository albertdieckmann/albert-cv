import { auth } from "@clerk/nextjs/server";
import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";
import { assignArea, type Area } from "@/lib/fringe-area";
import { buildSignedUrl } from "@/lib/fringe-api";

async function fetchRawEvents() {
  const festival = process.env.FRINGE_FESTIVAL_ID ?? "demofringe";
  const url = buildSignedUrl("/events", { festival, size: "100" });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Edinburgh API ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.results ?? data.items ?? data.events ?? []);
}

export async function POST() { return runVenueSync(); }

async function runVenueSync() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const raw = await fetchRawEvents();

  // Collect unique venues by name
  const venueMap = new Map<
    string,
    { address?: string; postcode?: string; lat?: number; lon?: number }
  >();
  for (const e of raw) {
    const v = e.venue;
    if (!v?.name || venueMap.has(v.name)) continue;
    venueMap.set(v.name, {
      address: v.address ?? undefined,
      postcode: v.post_code ?? undefined,
      lat: v.position?.lat,
      lon: v.position?.lon,
    });
  }

  const distribution: Record<Area, number> = {
    new_town: 0, old_town: 0, cowgate_grassmarket: 0,
    pleasance: 0, george_square: 0, southside: 0, other: 0,
  };
  const otherLog: { name: string; lat?: number; lon?: number; postcode?: string }[] = [];

  for (const [name, v] of venueMap) {
    const area = assignArea(v.lat, v.lon, v.postcode);
    distribution[area]++;
    if (area === "other") otherLog.push({ name, lat: v.lat, lon: v.lon, postcode: v.postcode });

    await sql`
      INSERT INTO fringe_venues (name, address, postcode, lat, lon, area)
      VALUES (${name}, ${v.address ?? null}, ${v.postcode ?? null},
              ${v.lat ?? null}, ${v.lon ?? null}, ${area})
      ON CONFLICT (name) DO UPDATE
        SET area     = EXCLUDED.area,
            lat      = EXCLUDED.lat,
            lon      = EXCLUDED.lon,
            postcode = EXCLUDED.postcode
    `;
  }

  return NextResponse.json({ ok: true, total: venueMap.size, distribution, otherLog });
}
