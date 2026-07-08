# Launch-hero grain refinements, the volume threshold, and small-sample making treatment

Settled against the launch hero's real per-zone counts (Cody Williams, 2025-26), which resolves what ADR-0003 deliberately left open:

- **Volume threshold:** a zone is *included* at **≥15 attempts**. All 6 evaluation zones clear this for the launch season.
- **No second hard cutoff on making.** Low-N zones are not suppressed on the making axis; they carry a **small-sample uncertainty flag** on the making delta instead. Attempt *share* stabilizes by ~34+ attempts, but per-zone *conversion* stays noisy there — so hiding it loses signal while flagging it stays honest.
- **Mid-Range is split into 8–16 / 16–24 ft for this hero.** ~46% of his mid-range (33 attempts) is the long-two band, clearing ≥15 — material, not negligible. The split exists for **selection transparency** (how much of his diet is the lowest-value shot), not as a making indictment: his long-two make rate (~45%) is fine.
- **Corner-3s are split left/right for this hero.** Both clear ≥15 (L49 / R34); per-corner making carries the small-sample flag.

**Why these are hero-specific, not engine-wide:** the generic engine defers finer grain (finer zones shred a single player-season into noise). These refinements ship *because Williams's actual counts support them*; a different hero re-runs the gate and may land differently.

**Record correction:** the mid-range decision was initially heading for *deferral* on a reported "0% long-two" — a bug (the report matched `'16-24 ft'` but the NBA literal is `'16-24 ft.'` with a trailing period, silently counting zero). With the real ~46% share, the split is promoted. Logged so no one re-defers it on the stale number.

**Consequences:** the v1 zone set is now fully fixed — 6 basic evaluation zones, with Mid-Range range-split and corner-3 area-split for the launch hero — so the pure aggregation function (ADR-0007) is fully specifiable. The seam and payload stay locked; compute-location A/B stays deferred (lean B).
