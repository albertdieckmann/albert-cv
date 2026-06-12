import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { buildSignedUrl } from "@/lib/fringe-api";
import { assignArea } from "@/lib/fringe-area";

// ─── Fringe API types ──────────────────────────────────────────────────────────

type FringePerformance = {
  start: string;
  end: string;
  duration_minutes?: number;
  price?: number;
  price_string?: string;
};

type FringeEvent = {
  url: string;
  title: string;
  sub_title?: string;
  artist?: string;
  genre?: string;
  description_teaser?: string;
  description?: string;
  website?: string;
  status?: string;
  venue?: {
    name: string;
    post_code?: string;
    position?: { lat: number; lon: number };
  };
  performances?: FringePerformance[];
};

// ─── Mapping ───────────────────────────────────────────────────────────────────

function mapEvent(e: FringeEvent) {
  const lat = e.venue?.position?.lat;
  const lon = e.venue?.position?.lon;
  const postcode = e.venue?.post_code;

  return {
    id: e.url,
    title: e.title,
    subTitle: e.sub_title || undefined,
    artist: e.artist || undefined,
    genre: e.genre || undefined,
    descriptionTeaser: e.description_teaser || e.description || undefined,
    website: e.website || undefined,
    venue: {
      name: e.venue?.name ?? "Venue TBA",
      area: assignArea(lat, lon, postcode),
    },
    performances: (e.performances ?? [])
      .map((p) => ({
        start: p.start,
        end: p.end,
        durationMinutes: p.duration_minutes,
        price: p.price,
        priceString: p.price_string,
      }))
      .sort((a, b) => a.start.localeCompare(b.start)),
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────

async function handleRefresh(req: NextRequest) {
  // Verify cron secret — accept from Vercel cron header or Authorization bearer
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    const cronHeader = req.headers.get("x-vercel-cron-secret");
    const token = authHeader?.replace("Bearer ", "") ?? cronHeader;
    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const key = process.env.FRINGE_API_KEY;
  const secret = process.env.FRINGE_API_SECRET;
  if (!key || !secret) {
    return NextResponse.json({ error: "Fringe API credentials missing" }, { status: 500 });
  }

  try {
    const festival = process.env.FRINGE_FESTIVAL_ID ?? "demofringe";
    const PAGE_SIZE = 100;

    // Fetch first page to seed total, then remaining pages in parallel
    const firstUrl = buildSignedUrl("/events", { festival, size: String(PAGE_SIZE), from: "0" });
    const firstRes = await fetch(firstUrl);
    if (!firstRes.ok) {
      const body = await firstRes.text().catch(() => "");
      console.error(`Fringe API ${firstRes.status}:`, body);
      return NextResponse.json({ error: `Fringe API error: ${firstRes.status}` }, { status: 502 });
    }

    const firstPage: FringeEvent[] = await firstRes.json();
    if (!Array.isArray(firstPage) || firstPage.length === 0) {
      return NextResponse.json({ inserted: 0, message: "No shows returned from API" });
    }

    let allRaw: FringeEvent[] = firstPage;
    if (firstPage.length === PAGE_SIZE) {
      const MAX_PAGES = 50;
      const remainingUrls = Array.from({ length: MAX_PAGES - 1 }, (_, i) =>
        buildSignedUrl("/events", { festival, size: String(PAGE_SIZE), from: String((i + 1) * PAGE_SIZE) })
      );
      const responses = await Promise.all(remainingUrls.map((url) => fetch(url)));
      const pages = await Promise.all(responses.map((r) => (r.ok ? r.json() : Promise.resolve([]))));
      for (const page of pages) {
        if (!Array.isArray(page) || page.length === 0) break;
        allRaw = allRaw.concat(page);
        if (page.length < PAGE_SIZE) break;
      }
    }

    const shows = allRaw.filter((e) => e.status !== "deleted").map(mapEvent);

    // Upsert in parallel batches of 50 (each batch is one SQL statement)
    const BATCH = 50;
    const now = new Date().toISOString();
    const batches: (typeof shows)[] = [];
    for (let i = 0; i < shows.length; i += BATCH) batches.push(shows.slice(i, i + BATCH));

    await Promise.all(
      batches.map((batch) => {
        // Build VALUES list: ($1,$2,$3),($4,$5,$6),...
        const values = batch.map((_, j) => `($${j * 3 + 1},$${j * 3 + 2}::jsonb,$${j * 3 + 3})`).join(",");
        const params = batch.flatMap((show) => [show.id, JSON.stringify(show), now]);
        return (sql as unknown as { query: (...args: unknown[]) => Promise<unknown> }).query(
          `INSERT INTO fringe_shows_cache (id, data, refreshed_at) VALUES ${values}
           ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, refreshed_at = EXCLUDED.refreshed_at`,
          params,
        );
      }),
    );

    // Delete shows that were not in this refresh (deleted/removed from API)
    // We do this by removing rows whose refreshed_at is older than the current refresh
    await sql`
      DELETE FROM fringe_shows_cache
      WHERE refreshed_at < ${now}
    `;

    console.log(`[fringe/shows/refresh] Upserted ${shows.length} shows at ${now}`);
    return NextResponse.json({ ok: true, inserted: shows.length, refreshedAt: now });
  } catch (err) {
    console.error("[fringe/shows/refresh] Failed:", err);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}

// Vercel cron calls GET; manual/admin calls can use POST
export const GET  = handleRefresh;
export const POST = handleRefresh;
