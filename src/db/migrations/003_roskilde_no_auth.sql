-- Roskilde planner v2: capability-URL identitet, ingen login krævet.
-- Kør én gang mod Vercel Postgres (eller via /api/roskilde/setup).

-- Grupper: tilgås med share_token (ikke brugt invite-koder)
CREATE TABLE IF NOT EXISTS roskilde_groups_v2 (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  share_token VARCHAR(20) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Medlemmer: member_id er den primære identitet
CREATE TABLE IF NOT EXISTS roskilde_members (
  member_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES roskilde_groups_v2(id) ON DELETE CASCADE,
  display_name VARCHAR(80) NOT NULL,
  recall_code  VARCHAR(6) NOT NULL,  -- 4-6 cifre, backup til member_id
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (group_id, recall_code)
);

-- Picks: idempotent upsert, opbevaret per performance
CREATE TABLE IF NOT EXISTS roskilde_picks_v2 (
  member_id  UUID NOT NULL REFERENCES roskilde_members(member_id) ON DELETE CASCADE,
  group_id   UUID NOT NULL REFERENCES roskilde_groups_v2(id) ON DELETE CASCADE,
  act_name   VARCHAR(200) NOT NULL,
  category   VARCHAR(20) NOT NULL CHECK (category IN ('vil_gerne','måske','ikke')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (member_id, act_name)
);

-- Lineup-cache: last-good kopi fra scraper
CREATE TABLE IF NOT EXISTS roskilde_lineup_cache (
  id          SERIAL PRIMARY KEY,
  fetched_at  TIMESTAMPTZ DEFAULT NOW(),
  item_count  INTEGER NOT NULL,
  data        JSONB NOT NULL
);
-- Bevar kun de 5 nyeste versioner (ryddes op af ingest-endpoint)
