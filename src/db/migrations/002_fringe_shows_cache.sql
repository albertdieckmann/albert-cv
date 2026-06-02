-- Cache table for Edinburgh Fringe shows
-- One row per show (keyed by the show's URL/id from the Fringe API)
-- data column holds the full mapped Show object as JSONB

CREATE TABLE IF NOT EXISTS fringe_shows_cache (
  id           TEXT        PRIMARY KEY,   -- show URL slug, e.g. "/events/show-slug"
  data         JSONB       NOT NULL,      -- mapped Show object
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup of the last refresh time (used by GET to check freshness)
CREATE INDEX IF NOT EXISTS fringe_shows_cache_refreshed_at_idx
  ON fringe_shows_cache (refreshed_at DESC);
