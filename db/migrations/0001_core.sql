-- 0001_core.sql — the record store's core observed schema (ADR-0080).
--
-- Stores observations at natural NBA identity, current state only. Derived
-- aggregates are views or downstream code, never tables here; product
-- concepts (slugs, heroes, verdicts) never appear — the export step joins
-- this schema to the hero registry (src/heroes/registry.ts). The raw layer's
-- files remain the ultimate rebuild source (ADR-0006): this schema is
-- rebuildable from them, and the snapshot table below is their catalog,
-- never their replacement.
--
-- Vocabulary CHECKs mirror the constants in ingestion/derive_payload.py; the
-- golden roundtrip test (ingestion/test_record_store.py) is what keeps the
-- two from drifting apart.

-- ---------------------------------------------------------------- lineage

CREATE TABLE snapshot (
  snapshot_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Which puller wrote the artifact; extend by migration when a new loader
  -- lands (pbp, box score, tracking, league totals — later slices).
  source         text NOT NULL CHECK (source IN ('shotchartdetail', 'league-advanced')),
  -- Repo-relative forward-slash path of the raw file on disk.
  path           text NOT NULL UNIQUE,
  -- Verbatim from the artifact's _meta; text, not date, so the export can
  -- reproduce it byte-for-byte.
  pull_date      text NOT NULL CHECK (pull_date ~ '^\d{4}-\d{2}-\d{2}$'),
  season         text NOT NULL CHECK (season ~ '^\d{4}-\d{2}$'),
  season_type    text NOT NULL,
  player_id      bigint,                    -- NULL for league-scoped artifacts
  -- Content identity: the raw layer is append-only, so a path re-cataloged
  -- with different bytes is corruption and the loader hard-fails.
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  cataloged_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE load_run (
  run_id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind       text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  -- The change-detection report: {table: {inserted, unchanged, changed}}.
  report     jsonb
);

CREATE TABLE load_run_snapshot (
  run_id      bigint NOT NULL REFERENCES load_run,
  snapshot_id bigint NOT NULL REFERENCES snapshot,
  PRIMARY KEY (run_id, snapshot_id)
);

-- -------------------------------------------------------------- reference

CREATE TABLE player (
  player_id   bigint PRIMARY KEY,          -- NBA identity, no surrogates
  name        text NOT NULL CHECK (name <> ''),
  snapshot_id bigint NOT NULL REFERENCES snapshot,
  run_id      bigint NOT NULL REFERENCES load_run
);

CREATE TABLE team (
  team_id     bigint PRIMARY KEY,          -- NBA identity
  -- stats.nba.com naming ("LA Clippers", not "Los Angeles Clippers").
  name        text NOT NULL CHECK (name <> ''),
  snapshot_id bigint NOT NULL REFERENCES snapshot,
  run_id      bigint NOT NULL REFERENCES load_run
);

CREATE TABLE game (
  game_id       text PRIMARY KEY CHECK (game_id ~ '^\d{10}$'),
  game_date     date NOT NULL,
  season        text NOT NULL CHECK (season ~ '^\d{4}-\d{2}$'),
  season_type   text NOT NULL,
  -- Abbreviations as observed in the source (HTM/VTM) — season-relative
  -- facts; the ADR-0028 static team map is a derivation over them. Team-id
  -- FK columns arrive with the box-score loader, which observes them.
  home_abbrev   text NOT NULL CHECK (home_abbrev ~ '^[A-Z]{2,3}$'),
  visitor_abbrev text NOT NULL CHECK (visitor_abbrev ~ '^[A-Z]{2,3}$'),
  snapshot_id   bigint NOT NULL REFERENCES snapshot,
  run_id        bigint NOT NULL REFERENCES load_run
);

-- ----------------------------------------------------------------- events

CREATE TABLE shot (
  -- Shot identity (ADR-0036): NBA game ID + game event number, exactly.
  game_id           text NOT NULL REFERENCES game,
  game_event_id     integer NOT NULL,
  player_id         bigint NOT NULL REFERENCES player,
  team_id           bigint NOT NULL REFERENCES team,  -- shooter's team, per row (trades)
  period            smallint NOT NULL CHECK (period >= 1),
  minutes_remaining smallint NOT NULL CHECK (minutes_remaining BETWEEN 0 AND 11),
  seconds_remaining smallint NOT NULL CHECK (seconds_remaining BETWEEN 0 AND 59),
  made              boolean NOT NULL,
  -- The scorer's call (SHOT_TYPE) — observed, never computed from zone.
  -- Deliberately NO cross-constraint against zone_basic: a zone-point
  -- conflict (ADR-0019) is a real observed row, stored here and
  -- dropped-and-counted at export, never made unrepresentable.
  point_value       smallint NOT NULL CHECK (point_value IN (2, 3)),
  zone_basic        text NOT NULL CHECK (zone_basic IN
                      ('Restricted Area', 'In The Paint (Non-RA)', 'Mid-Range',
                       'Left Corner 3', 'Right Corner 3', 'Above the Break 3',
                       'Backcourt')),
  zone_area         text NOT NULL CHECK (zone_area IN
                      ('Left Side(L)', 'Left Side Center(LC)', 'Center(C)',
                       'Right Side Center(RC)', 'Right Side(R)', 'Back Court(BC)')),
  -- Normalized (period-free) range literals — the one canonicalization
  -- applied at load, mirroring derive_payload.normalize_range.
  zone_range        text NOT NULL CHECK (zone_range IN
                      ('Less Than 8 ft', '8-16 ft', '16-24 ft', '24+ ft',
                       'Back Court Shot')),
  distance_ft       smallint NOT NULL CHECK (distance_ft >= 0),
  loc_x             integer NOT NULL,
  loc_y             integer NOT NULL,
  -- Observed but product-forbidden: ACTION_TYPE is creation-flavored data
  -- whose product use would be the Case-1 creation proxy ADR-0005 forbids.
  -- Stored for research; the export never reads it.
  action_type       text NOT NULL,
  -- The row's ordinal within its source snapshot. The response's row order
  -- is an observed fact and the payload's shots[] order — it is NOT a sort
  -- by (date, game, event), so the export orders by this.
  source_row        integer NOT NULL CHECK (source_row >= 0),
  snapshot_id       bigint NOT NULL REFERENCES snapshot,
  run_id            bigint NOT NULL REFERENCES load_run,
  PRIMARY KEY (game_id, game_event_id)
);

CREATE INDEX shot_player_idx ON shot (player_id, game_id);

-- ------------------------- observed aggregates (their sources' own grain)

-- The LeagueAverages frame, verbatim at the NBA's fine grain (ADR-0004:
-- pairs, never rates — rollups sum downstream). An observation: the league
-- baseline is never derivable from stored shots (we do not hold the league's
-- shots), and it belongs to the official universe.
CREATE TABLE league_zone_baseline (
  season      text NOT NULL CHECK (season ~ '^\d{4}-\d{2}$'),
  season_type text NOT NULL,
  zone_basic  text NOT NULL CHECK (zone_basic IN
                ('Restricted Area', 'In The Paint (Non-RA)', 'Mid-Range',
                 'Left Corner 3', 'Right Corner 3', 'Above the Break 3',
                 'Backcourt')),
  zone_area   text NOT NULL CHECK (zone_area IN
                ('Left Side(L)', 'Left Side Center(LC)', 'Center(C)',
                 'Right Side Center(RC)', 'Right Side(R)', 'Back Court(BC)')),
  zone_range  text NOT NULL CHECK (zone_range IN
                ('Less Than 8 ft', '8-16 ft', '16-24 ft', '24+ ft',
                 'Back Court Shot')),
  fga         integer NOT NULL CHECK (fga >= 0),
  fgm         integer NOT NULL CHECK (fgm >= 0),
  snapshot_id bigint NOT NULL REFERENCES snapshot,
  run_id      bigint NOT NULL REFERENCES load_run,
  PRIMARY KEY (season, season_type, zone_basic, zone_area, zone_range),
  CHECK (fgm <= fga)
);

-- Sourced per-player season facts from the league Advanced artifact
-- (ADR-0069): usage is presented verbatim, never computed. Loaded
-- league-wide — the record store is product-blind and serves players who
-- will never be heroes. Bounds here are row-grade sanity only; the hero
-- fence (0 < usage < 1, the FGA oracle) is a pipeline check at load/export.
CREATE TABLE player_season (
  player_id   bigint NOT NULL REFERENCES player,
  season      text NOT NULL CHECK (season ~ '^\d{4}-\d{2}$'),
  season_type text NOT NULL,
  gp          integer NOT NULL CHECK (gp >= 0),
  fga         integer NOT NULL CHECK (fga >= 0),
  usg_pct     double precision NOT NULL CHECK (usg_pct >= 0 AND usg_pct <= 1),
  snapshot_id bigint NOT NULL REFERENCES snapshot,
  run_id      bigint NOT NULL REFERENCES load_run,
  PRIMARY KEY (player_id, season, season_type)
);
