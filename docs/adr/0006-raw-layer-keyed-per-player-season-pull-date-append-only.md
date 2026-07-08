# The raw landing layer is keyed per (player, season, pull-date) and is append-only

The raw layer stores verbatim `shotchartdetail` responses keyed per **(player, season, pull-date)**. The **pull unit is the season**, not the game. Completed seasons are **immutable single snapshots** (pulled once, ever). In-progress seasons accrue **dated snapshots** — re-pulls are written as new snapshots, never overwriting. Derived data recomputes from the latest snapshot.

**Why:** This corrects an earlier stated-but-wrong model ("each game pulled once ever"), which bolted a per-game promise onto a per-season endpoint — `shotchartdetail` has no per-game mode in v1. Append-only + dated snapshots preserve what the (unofficial, day-to-day-changeable) endpoint said on each pull date, which is exactly the value for a live season.

**Considered:** Decomposing the season response into per-game records to preserve a per-game write-once model — rejected: the endpoint hands back a season, per-game structure would be imposed by us for no v1 benefit. Per-game write-once returns legitimately in v2 for Case 3 play-by-play, where the endpoint *is* per-game.

**Consequences:** The key is designed for the future (the later in-progress-season demo needs no storage refactor), but the logic that consumes multiple snapshots — snapshot selection, re-pull scheduling, diff/merge — is *not* built in v1, where a completed season has exactly one snapshot. A future contributor must not reintroduce overwrite-in-place or a per-game pull unit for v1.
