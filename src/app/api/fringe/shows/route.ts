import { NextResponse } from "next/server";
import { buildSignedUrl } from "@/lib/fringe-api";
import { assignArea, type Area } from "@/lib/fringe-area";

// ─── Fringe API types ──────────────────────────────────────────────────────────

type FringePerformance = {
  start: string;
  end: string;
  duration_minutes?: number;
  price?: number;
  concession?: number;
  price_string?: string;
  title?: string;
  type?: string;
};

type FringeEvent = {
  url: string;
  code?: string;
  title: string;
  sub_title?: string;
  artist?: string;
  artist_type?: string;
  genre?: string;
  genre_tags?: string[] | string;
  description_teaser?: string;
  website?: string;
  status?: string;
  venue?: {
    name: string;
    address?: string;
    post_code?: string;
    position?: { lat: number; lon: number };
  };
  performances?: FringePerformance[];
  images?: Record<string, { type: string; versions?: { original?: { url: string } }; original?: { url: string } }>;
};

// ─── Internal Show type (exported for use in page) ────────────────────────────

export type Show = {
  id: string;
  code?: string;
  title: string;
  subTitle?: string;
  artist?: string;
  artistType?: string;
  genre?: string;
  genreTags?: string[];
  descriptionTeaser?: string;
  website?: string;
  status?: string;
  venue: {
    name: string;
    address?: string;
    lat?: number;
    lon?: number;
    area: Area;
  };
  performances: {
    start: string;
    end: string;
    durationMinutes?: number;
    price?: number;
    concession?: number;
    priceString?: string;
    title?: string;
    type?: string;
  }[];
  imageUrl?: string;
};

// ─── Mapping ───────────────────────────────────────────────────────────────────

function mapEvent(e: FringeEvent): Show {
  const images = e.images ? Object.values(e.images) : [];
  const hero = images.find((i) => i.type === "hero");
  const thumb = images.find((i) => i.type === "thumb");
  const best = hero ?? thumb;
  const imageUrl = best?.versions?.original?.url ?? best?.original?.url;

  const lat = e.venue?.position?.lat;
  const lon = e.venue?.position?.lon;
  const postcode = e.venue?.post_code;

  return {
    id: e.url,
    code: e.code,
    title: e.title,
    subTitle: e.sub_title || undefined,
    artist: e.artist || undefined,
    artistType: e.artist_type || undefined,
    genre: e.genre || undefined,
    genreTags: e.genre_tags
      ? (typeof e.genre_tags === "string"
          ? e.genre_tags.split(",").map((t) => t.trim()).filter(Boolean)
          : e.genre_tags)
      : undefined,
    descriptionTeaser: e.description_teaser || undefined,
    website: e.website || undefined,
    status: e.status,
    venue: {
      name: e.venue?.name ?? "Venue TBA",
      address: e.venue?.address,
      lat,
      lon,
      area: assignArea(lat, lon, postcode),
    },
    performances: (e.performances ?? [])
      .map((p) => ({
        start: p.start,
        end: p.end,
        durationMinutes: p.duration_minutes,
        price: p.price,
        concession: p.concession,
        priceString: p.price_string,
        title: p.title || undefined,
        type: p.type || undefined,
      }))
      .sort((a, b) => a.start.localeCompare(b.start)),
    imageUrl,
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const key = process.env.FRINGE_API_KEY;
  const secret = process.env.FRINGE_API_SECRET;

  if (!key || !secret) {
    return NextResponse.json({ items: [], credentialsMissing: true });
  }

  try {
    const festival = process.env.FRINGE_FESTIVAL_ID ?? "demofringe";
    const PAGE_SIZE = 100;

    // Fetch first page to determine total, then fetch remaining pages in parallel
    const firstUrl = buildSignedUrl("/events", { festival, size: String(PAGE_SIZE), from: "0" });
    const firstRes = await fetch(firstUrl, { next: { revalidate: 3600 } });
    if (!firstRes.ok) {
      const body = await firstRes.text().catch(() => "");
      console.error(`Fringe API ${firstRes.status}:`, body);
      return NextResponse.json({ items: [], error: `API error: ${firstRes.status}` });
    }

    const firstPage: FringeEvent[] = await firstRes.json();
    if (!Array.isArray(firstPage) || firstPage.length === 0) {
      return NextResponse.json({ items: [], count: 0 });
    }

    // If first page is full, fetch remaining pages in parallel (cap at 50 pages = 5000 shows)
    let allRaw: FringeEvent[] = firstPage;
    if (firstPage.length === PAGE_SIZE) {
      const MAX_PAGES = 50;
      const remainingUrls = Array.from({ length: MAX_PAGES - 1 }, (_, i) =>
        buildSignedUrl("/events", { festival, size: String(PAGE_SIZE), from: String((i + 1) * PAGE_SIZE) })
      );
      const responses = await Promise.all(
        remainingUrls.map((url) => fetch(url, { next: { revalidate: 3600 } }))
      );
      const pages = await Promise.all(
        responses.map((r) => (r.ok ? r.json() : Promise.resolve([])))
      );
      for (const page of pages) {
        if (!Array.isArray(page) || page.length === 0) break;
        allRaw = allRaw.concat(page);
        if (page.length < PAGE_SIZE) break;
      }
    }

    const shows = allRaw.filter((e) => e.status !== "deleted").map(mapEvent);
    return NextResponse.json({ items: shows, count: shows.length });
  } catch (err) {
    console.error("Failed to fetch Fringe shows:", err);
    return NextResponse.json({ items: [], error: "Fetch failed" });
  }
}
