# League baselines are rolled up to the evaluation grain by summing makes/attempts, not averaging rates

The `LeagueAverages` frame arrives at fine zone grain (one row per zone combination). When rolling it up to the v1 evaluation grain (`SHOT_ZONE_BASIC`), compute each target zone's league FG% by **summing FGM and summing FGA across its sub-zones and dividing** — never by averaging the sub-zones' `FG_PCT` values.

**Why:** Averaging percentages across sub-zones of unequal attempt volume produces a wrong baseline (an unweighted mean over-weights low-volume sub-zones). The error is invisible to the eye — the number looks plausible — so it must be prevented structurally, not caught in review.

**Consequences:** Treated as a correctness invariant, not a preference: warrants a code comment at the rollup site and a reconciliation test asserting a rolled-up zone's PPS matches a hand-computed value. Every downstream number (diet-weighted expected PPS, per-zone making deltas) depends on this being right.
