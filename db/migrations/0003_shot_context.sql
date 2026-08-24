-- 0003_shot_context.sql — the Case 3 shot-context derivation and its
-- team-grain oracle (ADR-0080, third slice).
--
-- box_team_line is the observed team-grain box score: the official assist
-- totals the ADR-0046 reconciliation holds parsed play-by-play assists to,
-- plus the team naming trio (city/name/tricode) — which is also what lets
-- the team table learn the 23 teams no hero shoots for. shot_context is the
-- second derived table: one total row per sibling shot (ADR-0039), rebuilt
-- per run by the unmodified derive_shot_context grammar, never loaded.

CREATE TABLE box_team_line (
  game_id     text NOT NULL REFERENCES game,
  team_id     bigint NOT NULL,
  home        boolean NOT NULL,
  city        text NOT NULL,
  name        text NOT NULL,
  tricode     text NOT NULL CHECK (tricode ~ '^[A-Z]{2,3}$'),
  assists     integer NOT NULL CHECK (assists >= 0),
  -- Observed when present; a truncated fixture may omit it. assists stays
  -- NOT NULL because the ADR-0046 reconciliation is meaningless without it.
  points      integer CHECK (points >= 0),
  snapshot_id bigint NOT NULL REFERENCES snapshot,
  run_id      bigint NOT NULL REFERENCES load_run,
  PRIMARY KEY (game_id, team_id)
);

-- One normalized Case 3 context row per post-drop sibling shot (ADR-0032/
-- 0039/0048): statuses and typed failure reasons, never raw event prose.
-- Derived and rebuilt per run; event-match and assist status are
-- independent axes (ADR-0040).
CREATE TABLE shot_context (
  game_id         text NOT NULL,
  game_event_id   integer NOT NULL,
  player_id       bigint NOT NULL REFERENCES player,
  event_match     text NOT NULL CHECK (event_match IN
                    ('matched', 'missingGame', 'missingEvent',
                     'duplicateEvent', 'contradiction')),
  assist_status   text NOT NULL CHECK (assist_status IN
                    ('assisted', 'unassisted', 'notApplicable', 'unknown')),
  assist_evidence text NOT NULL CHECK (assist_evidence IN
                    ('descriptionCredit', 'validatedAbsence', 'notApplicable',
                     'unavailable')),
  failure_reason  text CHECK (failure_reason IN
                    ('missingGame', 'missingEvent', 'duplicateEvent',
                     'identityContradiction')),
  run_id          bigint NOT NULL REFERENCES load_run,
  PRIMARY KEY (game_id, game_event_id),
  FOREIGN KEY (game_id, game_event_id) REFERENCES shot (game_id, game_event_id),
  CHECK ((failure_reason IS NULL) = (event_match = 'matched'))
);

CREATE INDEX shot_context_player_idx ON shot_context (player_id, game_id);
