-- 0002_game_corpus.sql — the play-by-play/box-score corpus and the trip
-- derivation (ADR-0080, second slice).
--
-- pbp_event is the observation the record store's most rule-laden
-- derivations cite (ADR-0080): game-owned and shared (ADR-0045), all
-- players' events, league-scalable. box_score_line and
-- league_season_totals are the reconciliation oracles (per-game and
-- season-total, Gate 5 / ADR-0054). ft_trip is the first derived table:
-- rebuilt per run from pbp_event by the derive_freethrow grammar, never
-- hand-loaded.

-- Game-scoped artifacts (play-by-play, box score) state no season or
-- season_type of their own — their _meta is {game_id, pull_date} — so the
-- catalog columns relax to nullable and gain the game key.
ALTER TABLE snapshot ALTER COLUMN season DROP NOT NULL;
ALTER TABLE snapshot ALTER COLUMN season_type DROP NOT NULL;
ALTER TABLE snapshot ADD COLUMN game_id text CHECK (game_id ~ '^\d{10}$');
ALTER TABLE snapshot DROP CONSTRAINT snapshot_source_check;
ALTER TABLE snapshot ADD CONSTRAINT snapshot_source_check CHECK
  (source IN ('shotchartdetail', 'league-advanced', 'play-by-play',
              'box-score', 'league-totals'));

-- A corpus-only game (a hero free-throw game with zero field-goal attempts
-- — the Clifford case, ADR-0054's remedy) is observed only through its
-- pbp/box pair, which states no game date and no HTM/VTM strings. Those
-- facts stay NULL until a source observes them; abbreviations for such
-- games come from the box score's team tricodes.
ALTER TABLE game ALTER COLUMN game_date DROP NOT NULL;
ALTER TABLE game ALTER COLUMN home_abbrev DROP NOT NULL;
ALTER TABLE game ALTER COLUMN visitor_abbrev DROP NOT NULL;

-- ----------------------------------------------------------------- events

CREATE TABLE pbp_event (
  game_id       text NOT NULL REFERENCES game,
  -- NBA event identity (ADR-0036): the same actionNumber space shot
  -- identity lives in.
  action_number integer NOT NULL,
  -- The row's ordinal within its source artifact's actions list. The trip
  -- grammar's backward scan is defined over LIST order, which is an
  -- observed fact not guaranteed to equal actionNumber order.
  source_row    integer NOT NULL CHECK (source_row >= 0),
  action_id     integer,
  period        smallint CHECK (period >= 1),
  clock         text,
  action_type   text,
  sub_type      text,
  description   text,
  person_id     bigint,
  team_id       bigint,
  is_field_goal smallint CHECK (is_field_goal IN (0, 1)),
  shot_result   text,
  shot_value    smallint,
  shot_distance double precision,
  x_legacy      integer,
  y_legacy      integer,
  location      text,
  score_home    text,
  score_away    text,
  points_total  integer,
  snapshot_id   bigint NOT NULL REFERENCES snapshot,
  run_id        bigint NOT NULL REFERENCES load_run,
  PRIMARY KEY (game_id, action_number)
);

CREATE INDEX pbp_event_person_idx ON pbp_event (person_id, game_id);

-- ---------------------------------------------------------------- oracles

-- Per-player box-score lines (BoxScoreTraditionalV3): the per-game
-- reconciliation oracle (ADR-0046/0054), never an alternate event source.
CREATE TABLE box_score_line (
  game_id     text NOT NULL REFERENCES game,
  player_id   bigint NOT NULL REFERENCES player,
  team_id     bigint NOT NULL,
  home        boolean NOT NULL,
  minutes     text,
  points      integer NOT NULL CHECK (points >= 0),
  fgm         integer NOT NULL CHECK (fgm >= 0),
  fga         integer NOT NULL CHECK (fga >= 0),
  tpm         integer NOT NULL CHECK (tpm >= 0),
  tpa         integer NOT NULL CHECK (tpa >= 0),
  ftm         integer NOT NULL CHECK (ftm >= 0),
  fta         integer NOT NULL CHECK (fta >= 0),
  reb         integer NOT NULL CHECK (reb >= 0),
  ast         integer NOT NULL CHECK (ast >= 0),
  snapshot_id bigint NOT NULL REFERENCES snapshot,
  run_id      bigint NOT NULL REFERENCES load_run,
  PRIMARY KEY (game_id, player_id),
  CHECK (fgm <= fga), CHECK (tpm <= tpa), CHECK (ftm <= fta)
);

-- Per-player league season totals (Gate 5's season oracle, ADR-0054), the
-- free-throw payload's league baseline source. Loaded league-wide.
CREATE TABLE league_season_totals (
  player_id   bigint NOT NULL REFERENCES player,
  season      text NOT NULL CHECK (season ~ '^\d{4}-\d{2}$'),
  season_type text NOT NULL,
  gp          integer NOT NULL CHECK (gp >= 0),
  fgm         integer NOT NULL CHECK (fgm >= 0),
  fga         integer NOT NULL CHECK (fga >= 0),
  ftm         integer NOT NULL CHECK (ftm >= 0),
  fta         integer NOT NULL CHECK (fta >= 0),
  pts         integer NOT NULL CHECK (pts >= 0),
  snapshot_id bigint NOT NULL REFERENCES snapshot,
  run_id      bigint NOT NULL REFERENCES load_run,
  PRIMARY KEY (player_id, season, season_type),
  CHECK (fgm <= fga), CHECK (ftm <= fta)
);

-- ---------------------------------------------------------------- derived

-- Trips (ADR-0053), derived from pbp_event by the derive_freethrow grammar
-- and rebuilt per run — never loaded from a source. Identity is the trip's
-- first free-throw event: always present, unlike the causing foul
-- (flagrant/clear-path trips never resolve one), and stronger than
-- (game, period, clock), where ties are physically possible.
CREATE TABLE ft_trip (
  game_id            text NOT NULL REFERENCES game,
  first_ft_action    integer NOT NULL,
  -- actions-list ordinal of the first free throw: the payload's trip order.
  first_ft_row       integer NOT NULL CHECK (first_ft_row >= 0),
  player_id          bigint NOT NULL REFERENCES player,
  period             smallint NOT NULL CHECK (period >= 1),
  clock              text NOT NULL,
  trip_class         text NOT NULL CHECK (trip_class IN
                       ('shootingFoul2', 'shootingFoul3', 'bonus', 'andOne',
                        'flagrant', 'awayFromPlay', 'transitionTake', 'clearPath')),
  ftm                smallint NOT NULL CHECK (ftm >= 0),
  fta                smallint NOT NULL CHECK (fta BETWEEN 1 AND 3),
  -- The and-one's made counted shot (ADR-0053); NULL for every other class.
  shot_game_event_id integer,
  run_id             bigint NOT NULL REFERENCES load_run,
  PRIMARY KEY (game_id, first_ft_action),
  FOREIGN KEY (game_id, shot_game_event_id) REFERENCES shot (game_id, game_event_id),
  CHECK (ftm <= fta),
  CHECK ((trip_class = 'andOne') = (shot_game_event_id IS NOT NULL))
);

CREATE INDEX ft_trip_player_idx ON ft_trip (player_id, game_id);
