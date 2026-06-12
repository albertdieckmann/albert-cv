import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock @vercel/postgres ─────────────────────────────────────────────────────
// sql is a tagged-template function; we need it to be callable as sql`...`
// and return { rows: [] } by default.

const mockSql = vi.fn().mockResolvedValue({ rows: [] });
mockSql.query = vi.fn().mockResolvedValue({ rows: [] });
vi.mock("@vercel/postgres", () => ({ sql: mockSql }));

// ─── Mock @/app/fringe/lib/api ─────────────────────────────────────────────────────
vi.mock("@/app/fringe/lib/api", () => ({
  buildSignedUrl: (_path: string, params: Record<string, string>) =>
    `https://mock-fringe-api/events?from=${params.from ?? "0"}`,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(opts: { method?: string; headers?: Record<string, string> } = {}) {
  return new Request("http://localhost/api/fringe/shows/refresh", {
    method: opts.method ?? "POST",
    headers: opts.headers ?? {},
  }) as never;
}

/** Build a minimal valid FringeEvent as returned by the external API */
function fringeEvent(overrides: Record<string, unknown> = {}) {
  return {
    url: "https://api.edinburghfestivalcity.com/events/abc123",
    title: "Test Show",
    genre: "Comedy",
    venue: { name: "Pleasance Courtyard", post_code: "EH89 8NY" },
    performances: [
      { start: "2025-08-05T19:30:00Z", end: "2025-08-05T20:30:00Z", price: 15 },
    ],
    ...overrides,
  };
}

/** Fake a successful fetch response returning JSON */
function mockFetchOk(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** Fake a failed fetch response */
function mockFetchError(status: number): Response {
  return new Response("error", { status });
}

// ─── GET /api/fringe/shows ─────────────────────────────────────────────────────

describe("GET /api/fringe/shows", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns shows from the DB cache", async () => {
    const show = { id: "abc", title: "My Show", venue: { name: "Venue", area: "old_town" }, performances: [] };
    mockSql.mockResolvedValueOnce({ rows: [{ data: show }] });

    const { GET } = await import("@/app/api/fringe/shows/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.items[0].title).toBe("My Show");
    expect(body.cacheEmpty).toBeUndefined();
  });

  it("returns cacheEmpty:true when the table is empty", async () => {
    mockSql.mockResolvedValueOnce({ rows: [] });

    const { GET } = await import("@/app/api/fringe/shows/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(0);
    expect(body.cacheEmpty).toBe(true);
  });

  it("returns 500 when the DB query throws", async () => {
    mockSql.mockRejectedValueOnce(new Error("DB connection failed"));

    const { GET } = await import("@/app/api/fringe/shows/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBeDefined();
  });

  it("returns all shows with correct shape", async () => {
    const shows = Array.from({ length: 5 }, (_, i) => ({
      id: `show-${i}`,
      title: `Show ${i}`,
      genre: "Theatre",
      venue: { name: "Venue", area: "george_square" },
      performances: [{ start: "2025-08-10T20:00:00Z", end: "2025-08-10T21:00:00Z" }],
    }));
    mockSql.mockResolvedValueOnce({ rows: shows.map((s) => ({ data: s })) });

    const { GET } = await import("@/app/api/fringe/shows/route");
    const res = await GET();
    const body = await res.json();

    expect(body.count).toBe(5);
    expect(body.items).toHaveLength(5);
    body.items.forEach((item: { id: string }, i: number) => {
      expect(item.id).toBe(`show-${i}`);
    });
  });
});

// ─── POST /api/fringe/shows/refresh — authentication ──────────────────────────

describe("POST /api/fringe/shows/refresh — authentication", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET: "test-secret", FRINGE_API_KEY: "key", FRINGE_API_SECRET: "secret" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 401 with no auth header when CRON_SECRET is set", async () => {
    const { POST } = await import("@/app/api/fringe/shows/refresh/route");
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong bearer token", async () => {
    const { POST } = await import("@/app/api/fringe/shows/refresh/route");
    const res = await POST(makeRequest({ headers: { authorization: "Bearer wrong-secret" } }));
    expect(res.status).toBe(401);
  });

  it("passes auth with correct bearer token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchOk([fringeEvent()])
    );

    const { POST } = await import("@/app/api/fringe/shows/refresh/route");
    const res = await POST(makeRequest({ headers: { authorization: "Bearer test-secret" } }));
    // Should get past auth (not 401)
    expect(res.status).not.toBe(401);
  });

  it("passes auth with x-vercel-cron-secret header", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchOk([fringeEvent()])
    );

    const { POST } = await import("@/app/api/fringe/shows/refresh/route");
    const res = await POST(makeRequest({ headers: { "x-vercel-cron-secret": "test-secret" } }));
    expect(res.status).not.toBe(401);
  });

  it("skips auth check when CRON_SECRET is not set", async () => {
    delete process.env.CRON_SECRET;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockFetchOk([fringeEvent()])
    );

    const { POST } = await import("@/app/api/fringe/shows/refresh/route");
    const res = await POST(makeRequest()); // no auth headers
    expect(res.status).not.toBe(401);
  });
});

// ─── POST /api/fringe/shows/refresh — credentials ─────────────────────────────

describe("POST /api/fringe/shows/refresh — credentials", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // No CRON_SECRET so auth is skipped
    process.env = { ...originalEnv, CRON_SECRET: undefined, FRINGE_API_KEY: undefined, FRINGE_API_SECRET: undefined };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 500 when Fringe API credentials are missing", async () => {
    const { POST } = await import("@/app/api/fringe/shows/refresh/route");
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toMatch(/credentials/i);
  });
});

// ─── POST /api/fringe/shows/refresh — happy path ──────────────────────────────

describe("POST /api/fringe/shows/refresh — happy path", () => {
  const originalEnv = process.env;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      CRON_SECRET: undefined,  // skip auth
      FRINGE_API_KEY: "key",
      FRINGE_API_SECRET: "secret",
      FRINGE_FESTIVAL_ID: "testfestival",
    };
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    process.env = originalEnv;
    fetchSpy.mockRestore();
  });

  it("upserts shows and returns count when first page is not full", async () => {
    // Single page with 3 shows (less than PAGE_SIZE=100 → no further pages fetched)
    const events = [fringeEvent(), fringeEvent({ url: "abc456" }), fringeEvent({ url: "abc789" })];
    fetchSpy.mockResolvedValueOnce(mockFetchOk(events));

    const { POST } = await import("@/app/api/fringe/shows/refresh/route");
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.inserted).toBe(3);
    expect(body.refreshedAt).toBeDefined();
    // 1 batch upsert via sql.query + 1 delete-stale via sql tagged template
    expect(mockSql.query).toHaveBeenCalledTimes(1);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });

  it("filters out deleted shows", async () => {
    const events = [
      fringeEvent({ url: "active1" }),
      fringeEvent({ url: "deleted1", status: "deleted" }),
      fringeEvent({ url: "active2" }),
    ];
    fetchSpy.mockResolvedValueOnce(mockFetchOk(events));

    const { POST } = await import("@/app/api/fringe/shows/refresh/route");
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(body.inserted).toBe(2); // deleted show excluded
  });

  it("returns 502 when the Fringe API returns an error status", async () => {
    fetchSpy.mockResolvedValueOnce(mockFetchError(503));

    const { POST } = await import("@/app/api/fringe/shows/refresh/route");
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/503/);
  });

  it("returns gracefully when the API returns an empty array", async () => {
    fetchSpy.mockResolvedValueOnce(mockFetchOk([]));

    const { POST } = await import("@/app/api/fringe/shows/refresh/route");
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.inserted).toBe(0);
    expect(body.message).toBeDefined();
  });

  it("returns 500 when the DB upsert throws", async () => {
    fetchSpy.mockResolvedValueOnce(mockFetchOk([fringeEvent()]));
    mockSql.mockRejectedValueOnce(new Error("DB write failed"));

    const { POST } = await import("@/app/api/fringe/shows/refresh/route");
    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBeDefined();
  });
});

// ─── mapEvent — show mapping ───────────────────────────────────────────────────
// We test mapping indirectly via the refresh route output captured in mockSql calls.
// Alternatively we test area assignment directly via fringe-area.

describe("area assignment (fringe-area)", () => {
  it("assigns old_town for EH1 postcodes", async () => {
    const { assignArea } = await import("@/app/fringe/lib/area");
    expect(assignArea(undefined, undefined, "EH1 1BB")).toBe("old_town");
  });

  it("assigns george_square for EH8 postcodes (non-EH89)", async () => {
    const { assignArea } = await import("@/app/fringe/lib/area");
    expect(assignArea(undefined, undefined, "EH8 1TF")).toBe("george_square");
  });

  it("assigns pleasance for EH89 postcodes", async () => {
    const { assignArea } = await import("@/app/fringe/lib/area");
    expect(assignArea(undefined, undefined, "EH89 8NY")).toBe("pleasance");
  });

  it("assigns new_town for EH2 postcodes", async () => {
    const { assignArea } = await import("@/app/fringe/lib/area");
    expect(assignArea(undefined, undefined, "EH2 4AB")).toBe("new_town");
  });

  it("assigns southside for EH9 postcodes", async () => {
    const { assignArea } = await import("@/app/fringe/lib/area");
    expect(assignArea(undefined, undefined, "EH9 1JN")).toBe("southside");
  });

  it("assigns other for unknown postcodes", async () => {
    const { assignArea } = await import("@/app/fringe/lib/area");
    expect(assignArea(undefined, undefined, "G1 1AA")).toBe("other");
  });

  it("assigns other when postcode is missing", async () => {
    const { assignArea } = await import("@/app/fringe/lib/area");
    expect(assignArea(undefined, undefined, undefined)).toBe("other");
  });
});
