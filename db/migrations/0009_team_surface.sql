-- 0009_team_surface.sql — the team shot payload's observations (ADR-0082,
-- the Jazz surface's first increment).
--
-- Team shot rows load into the EXISTING shot table at natural identity: a
-- shot is a shot, and a hero's rows arriving from both his own pull and the
-- team-wide pull must agree (change detection arbitrates). What is new is
-- the roster — observed nightly from commonteamroster, current state only,
-- scope-complete per (team, season) so a departed player leaves the roster
-- and keeps his shot rows — and the catalog's team dimension for the two
-- team-scoped sources.
--
-- Written as 0007_team_shots.sql on proto_VideoAnalysis; renamed 0009 at
-- the Jazz-site integration (2026-09-24) to sort after the two migrations
-- the production store had already applied from the game-card branch
-- (0007_twelve_minute_clock, 0008_split_trip_families). It was never
-- applied to production under the old name. Never rename a migration a
-- store has recorded in schema_migration: it would run again.

ALTER TABLE snapshot ADD COLUMN team_id bigint;
ALTER TABLE snapshot DROP CONSTRAINT snapshot_source_check;
ALTER TABLE snapshot ADD CONSTRAINT snapshot_source_check CHECK
  (source IN ('shotchartdetail', 'league-advanced', 'play-by-play',
              'box-score', 'league-totals', 'tracking-player',
              'tracking-league', 'shotchartdetail-team', 'commonteamroster'));

CREATE TABLE roster_entry (
  team_id     bigint NOT NULL REFERENCES team,
  season      text NOT NULL CHECK (season ~ '^\d{4}-\d{2}$'),
  season_type text NOT NULL,
  player_id   bigint NOT NULL REFERENCES player,
  -- The roster's own spelling of the name (the shot chart's may differ in
  -- diacritics); carried verbatim into the payload's roster[].
  player_name text NOT NULL CHECK (player_name <> ''),
  -- Verbatim source strings: NUM may be empty (no number assigned yet), EXP
  -- is 'R' or a season count. Descriptive labels, never reconciled.
  number      text NOT NULL,
  position    text NOT NULL,
  experience  text NOT NULL,
  -- Response order — the payload's roster order.
  source_row  integer NOT NULL CHECK (source_row >= 0),
  snapshot_id bigint NOT NULL REFERENCES snapshot,
  run_id      bigint NOT NULL REFERENCES load_run,
  PRIMARY KEY (team_id, season, season_type, player_id)
);
