-- 0006_source_head.sql — living-season provenance (ADR-0080, as amended).
--
-- Row provenance (snapshot_id/run_id on observed rows) is FIRST-ASSERTED
-- lineage and never rewritten for unchanged rows — so under a living
-- season's daily loads, a scope's rows legitimately carry mixed row
-- provenance. The snapshot a payload names is a different fact: the source
-- whose content the scope's CURRENT STATE equals. That is recorded here
-- explicitly at load time, one row per scope, moved by every load that
-- asserts the scope — never inferred from filenames or catalog order
-- (replay-era partial artifacts sort after real ones, so "latest path" is
-- not a safe rule). Exports read heads; loaders write them.
--
-- scope_key is 'source:player_id:season:season_type:game_id' with empty
-- segments for dimensions the source is not scoped by.

CREATE TABLE source_head (
  scope_key   text PRIMARY KEY,
  snapshot_id bigint NOT NULL REFERENCES snapshot,
  run_id      bigint NOT NULL REFERENCES load_run,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
