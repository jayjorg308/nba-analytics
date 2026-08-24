-- 0005_creation.sql — the tracking universe (ADR-0080, fourth slice).
--
-- Tracking is its own source universe (CONTEXT.md): these tables are
-- OBSERVATIONS at their sources' own grains, never derivable from stored
-- shots. creation_split holds the player dashboards' aggregate rows at the
-- NBA's context grain (ADR-0030); only rows the dashboard actually emitted
-- are stored — a zero-attempt context is an absent row, zero-filled at
-- export (the sparse-row rule). league_creation_team holds the league
-- baseline at its observed TEAM grain, summed at export per ADR-0004;
-- family 'overall' is the unfiltered call, and General's unresolved
-- residual context ('Other') has no rows — the export computes it by count
-- subtraction, counts never rates.

ALTER TABLE snapshot DROP CONSTRAINT snapshot_source_check;
ALTER TABLE snapshot ADD CONSTRAINT snapshot_source_check CHECK
  (source IN ('shotchartdetail', 'league-advanced', 'play-by-play',
              'box-score', 'league-totals', 'tracking-player',
              'tracking-league'));

CREATE TABLE creation_split (
  player_id   bigint NOT NULL REFERENCES player,
  season      text NOT NULL CHECK (season ~ '^\d{4}-\d{2}$'),
  season_type text NOT NULL,
  family      text NOT NULL,
  context     text NOT NULL,
  fga         integer NOT NULL CHECK (fga >= 0),
  fgm         integer NOT NULL CHECK (fgm >= 0),
  fg2a        integer NOT NULL CHECK (fg2a >= 0),
  fg2m        integer NOT NULL CHECK (fg2m >= 0),
  fg3a        integer NOT NULL CHECK (fg3a >= 0),
  fg3m        integer NOT NULL CHECK (fg3m >= 0),
  snapshot_id bigint NOT NULL REFERENCES snapshot,
  run_id      bigint NOT NULL REFERENCES load_run,
  PRIMARY KEY (player_id, season, season_type, family, context),
  CHECK (fga = fg2a + fg3a),
  CHECK (fgm = fg2m + fg3m),
  CHECK (fgm <= fga), CHECK (fg2m <= fg2a), CHECK (fg3m <= fg3a),
  -- The NBA's context vocabularies, verbatim (derive_creation.py mirrors);
  -- an unknown literal is vocabulary drift and must fail, never load.
  CHECK (
    (family = 'general' AND context IN
      ('Catch and Shoot', 'Pull Ups', 'Less than 10 ft', 'Other'))
    OR (family = 'shotClock' AND context IN
      ('24-22', '22-18 Very Early', '18-15 Early', '15-7 Average',
       '7-4 Late', '4-0 Very Late'))
    OR (family = 'closestDefender' AND context IN
      ('0-2 Feet - Very Tight', '2-4 Feet - Tight', '4-6 Feet - Open',
       '6+ Feet - Wide Open'))
  )
);

CREATE TABLE league_creation_team (
  season      text NOT NULL CHECK (season ~ '^\d{4}-\d{2}$'),
  season_type text NOT NULL,
  family      text NOT NULL,
  context     text NOT NULL,
  team_id     bigint NOT NULL,
  fga         integer NOT NULL CHECK (fga >= 0),
  fgm         integer NOT NULL CHECK (fgm >= 0),
  fg2a        integer NOT NULL CHECK (fg2a >= 0),
  fg2m        integer NOT NULL CHECK (fg2m >= 0),
  fg3a        integer NOT NULL CHECK (fg3a >= 0),
  fg3m        integer NOT NULL CHECK (fg3m >= 0),
  snapshot_id bigint NOT NULL REFERENCES snapshot,
  run_id      bigint NOT NULL REFERENCES load_run,
  PRIMARY KEY (season, season_type, family, context, team_id),
  CHECK (fga = fg2a + fg3a),
  CHECK (fgm = fg2m + fg3m),
  CHECK (fgm <= fga), CHECK (fg2m <= fg2a), CHECK (fg3m <= fg3a),
  CHECK (
    (family = 'overall' AND context = 'Overall')
    OR (family = 'general' AND context IN
      ('Catch and Shoot', 'Pull Ups', 'Less than 10 ft', 'Other'))
    OR (family = 'shotClock' AND context IN
      ('24-22', '22-18 Very Early', '18-15 Early', '15-7 Average',
       '7-4 Late', '4-0 Very Late'))
    OR (family = 'closestDefender' AND context IN
      ('0-2 Feet - Very Tight', '2-4 Feet - Tight', '4-6 Feet - Open',
       '6+ Feet - Wide Open'))
  )
);
