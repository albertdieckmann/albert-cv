import { createHmac } from "crypto";
import { NextResponse } from "next/server";

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
  genre_tags?: string[];
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
  images?: Record<string, { type: string; original?: { url: string } }>;
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
  venue: { name: string; address?: string; lat?: number; lon?: number };
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

// ─── Auth ──────────────────────────────────────────────────────────────────────

const API_BASE = "https://api.edinburghfestivalcity.com";

function buildSignedUrl(path: string, params: Record<string, string>): string {
  const key = process.env.FRINGE_API_KEY!;
  const secret = process.env.FRINGE_API_SECRET!;

  // Content params first, then key — signature excluded from the signed string
  const allParams = { ...params, key };
  const qs = Object.entries(allParams)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const toSign = `${path}?${qs}`;
  // API requires plain ASCII hex — not base64
  const sig = createHmac("sha1", secret).update(toSign).digest("hex");

  return `${API_BASE}${toSign}&signature=${sig}`;
}

// ─── Mapping ───────────────────────────────────────────────────────────────────

function mapEvent(e: FringeEvent): Show {
  const images = e.images ? Object.values(e.images) : [];
  const hero = images.find((i) => i.type === "hero");
  const thumb = images.find((i) => i.type === "thumb");
  const imageUrl = (hero ?? thumb)?.original?.url;

  return {
    id: e.url,
    code: e.code,
    title: e.title,
    subTitle: e.sub_title || undefined,
    artist: e.artist || undefined,
    artistType: e.artist_type || undefined,
    genre: e.genre || undefined,
    genreTags: e.genre_tags?.length ? e.genre_tags : undefined,
    descriptionTeaser: e.description_teaser || undefined,
    website: e.website || undefined,
    status: e.status,
    venue: {
      name: e.venue?.name ?? "Venue TBA",
      address: e.venue?.address,
      lat: e.venue?.position?.lat,
      lon: e.venue?.position?.lon,
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
    const url = buildSignedUrl("/events", { festival, size: "500" });

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Fringe API ${res.status}:`, body);
      return NextResponse.json({ items: [], error: `API error: ${res.status}` });
    }

    const data = await res.json();
    const raw: FringeEvent[] = Array.isArray(data)
      ? data
      : (data.results ?? data.items ?? data.events ?? []);

    const shows = raw.filter((e) => e.status !== "deleted").map(mapEvent);
    return NextResponse.json({ items: shows, count: shows.length });
  } catch (err) {
    console.error("Failed to fetch Fringe shows:", err);
    return NextResponse.json({ items: [], error: "Fetch failed" });
  }
}
