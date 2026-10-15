-- 0010_game_payload.sql — the game payload's observations (ADR-0088) and
-- the pre-game ruler (ADR-0089).
--
-- Three new raw sources reach the store:
--   - league-ruler: the LeagueAverages frame through a date (DateTo only),
--     the ruler a game played the next day is priced against. Stored at the
--     frame's own fine grain like league_zone_baseline, keyed by its
--     through-date. A ruler for a past date never grows: any change to a
--     loaded ruler is a correction and halts.
--   - league-game-log: every game the league has played, with its date —
--     the source of a ruler's game count (the frame states attempts, never
--     how many games they came from). Its own table, not the game table:
--     the game table holds games some loaded source has shots or a pbp/box
--     pair for; this one is the league's schedule as played.
--   - shotchartdetail-team-game: one team's shots in one game (a team-wide
--     pull windowed to the game's date) — the report card's opponent side.
--     Its rows land in the EXISTING shot table at natural identity; its
--     one-day LeagueAverages frame is never loaded anywhere (it is that
--     day's league only, never a ruler).

ALTER TABLE snapshot DROP CONSTRAINT snapshot_source_check;
ALTER TABLE snapshot ADD CONSTRAINT snapshot_source_check CHECK
  (source IN ('shotchartdetail', 'league-advanced', 'play-by-play',
              'box-score', 'league-totals', 'tracking-player',
              'tracking-league', 'shotchartdetail-team', 'commonteamroster',
              'league-ruler', 'league-game-log', 'shotchartdetail-team-game'));

CREATE TABLE league_ruler_zone (
  season       text NOT NULL CHECK (season ~ '^\d{4}-\d{2}$'),
  season_type  text NOT NULL,
  -- Inclusive: the frame counts every league attempt on or before this date.
  through_date date NOT NULL,
  zone_basic   text NOT NULL CHECK (zone_basic IN
                 ('Restricted Area', 'In The Paint (Non-RA)', 'Mid-Range',
                  'Left Corner 3', 'Right Corner 3', 'Above the Break 3',
                  'Backcourt')),
  zone_area    text NOT NULL CHECK (zone_area IN
                 ('Left Side(L)', 'Left Side Center(LC)', 'Center(C)',
                  'Right Side Center(RC)', 'Right Side(R)', 'Back Court(BC)')),
  zone_range   text NOT NULL CHECK (zone_range IN
                 ('Less Than 8 ft', '8-16 ft', '16-24 ft', '24+ ft',
                  'Back Court Shot')),
  fga          integer NOT NULL CHECK (fga >= 0),
  fgm          integer NOT NULL CHECK (fgm >= 0),
  snapshot_id  bigint NOT NULL REFERENCES snapshot,
  run_id       bigint NOT NULL REFERENCES load_run,
  PRIMARY KEY (season, season_type, through_date, zone_basic, zone_area, zone_range),
  CHECK (fgm <= fga)
);

CREATE TABLE league_game (
  game_id     text PRIMARY KEY CHECK (game_id ~ '^\d{10}$'),
  season      text NOT NULL CHECK (season ~ '^\d{4}-\d{2}$'),
  season_type text NOT NULL,
  game_date   date NOT NULL,
  -- The two teams in id order, never as home and visitor: the log's
  -- MATCHUP reads '@' for both rows of a neutral-site game (five in
  -- 2025-26), so it cannot say who was home. Home comes from the box
  -- score.
  team_a_id   bigint NOT NULL,
  team_b_id   bigint NOT NULL,
  snapshot_id bigint NOT NULL REFERENCES snapshot,
  run_id      bigint NOT NULL REFERENCES load_run,
  CHECK (team_a_id < team_b_id)
);

CREATE INDEX league_game_date_idx ON league_game (season, season_type, game_date);
