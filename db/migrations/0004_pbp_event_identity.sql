-- 0004_pbp_event_identity.sql — pbp_event's identity is the list position,
-- not actionNumber (ADR-0080 corrective).
--
-- PlayByPlayV3 actionNumbers repeat within a game — the shot-context
-- grammar deliberately preserves duplicates and classifies affected shots
-- duplicateEvent (ADR-0036) — so keying storage by (game_id, action_number)
-- silently collapsed real observed events. Found by the context parity
-- oracle: 44 of one hero-season's misses lost their field-goal events to a
-- later same-numbered non-FG action. The observed identity of an action row
-- is its position in the artifact's actions list; action_number remains the
-- cross-source event identity, duplicates and all, via a plain index.
--
-- A store loaded under the old key holds collapsed (missing) rows: rebuild
-- the pbp side from raw (delete pbp_event and its derived tables, re-run
-- load_game_corpus) — the record store is rebuildable by doctrine (ADR-0080).
ALTER TABLE pbp_event DROP CONSTRAINT pbp_event_pkey;
ALTER TABLE pbp_event ADD PRIMARY KEY (game_id, source_row);
CREATE INDEX pbp_event_action_idx ON pbp_event (game_id, action_number);
