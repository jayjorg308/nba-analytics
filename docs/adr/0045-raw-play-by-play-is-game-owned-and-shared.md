# Raw play-by-play is game-owned and shared across heroes

Each verbatim Case 3 response is stored once at `data/raw/play-by-play/<game-id>/<pull-date>.json` and shared by every player-season that references the game. The endpoint returns a whole game regardless of storage layout, so player-owned copies would not avoid filtering; they would duplicate identical source bytes and allow two heroes' copies of the same game to drift.

A player-season pull reads the shot snapshot's unique game IDs and fills missing shared artifacts. Derivation selects the latest dated artifact, builds an action-number index once per game, and performs exact lookups for the hero's shots; at the current 54–68 games per deployed player-season, this work is negligible beside network acquisition and JSON parsing. Re-pulls remain append-only, and payload provenance records the exact game snapshots used.
