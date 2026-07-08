# nba-analytics

An interactive, shareable web tool that analyzes a single NBA player's shot selection. One "hero" player at a time, on a player-agnostic data/computation engine.

_The driving question was originally phrased in two clauses — "is this player taking good shots, **and how are they creating them?**" It was deliberately narrowed: v1 answers only the first clause. "How are they created" needs deferred Case 2/3 data and is promoted to an explicit v2 thesis (see below and ADR-0005). This note exists so the original wide phrasing isn't mistaken for the mandate._

## Language

**Good shot**:
A shot with high expected value — the points-per-shot expected from its location/context, judged *independently of whether it went in*. A made low-value shot is still a bad shot; a missed high-value shot is still a good shot.
_Avoid_: "makeable shot", "high-percentage shot" (raw FG% ignores the 3-vs-2 point difference)

**Points-per-shot (PPS)**:
The expected-value metric. `PPS = zone FG% × point value` (3 in three-point zones, 2 elsewhere). The unit in which shot quality is measured, so a 38% three (1.14 PPS) correctly outranks a 45% mid-range (0.90 PPS).

**Zone baseline**:
League-average shooting by court zone (`SHOT_ZONE_BASIC` / `SHOT_ZONE_AREA` / `SHOT_ZONE_RANGE`), used as the benchmark for evaluating a player's shots. Sourced from the `LeagueAverages` frame returned alongside the player's shots in every `shotchartdetail` pull — not a separate pull or table.

**Evaluation grain**:
The zone granularity at which v1 evaluates shots: `SHOT_ZONE_BASIC` (7 zones; 6 after excluding Backcourt). Coarse enough that a rotation player has real per-zone samples, and it already isolates the value-critical distinctions (corner-3 vs above-break-3, restricted area vs paint vs mid-range). For the launch hero, the grain is refined in two data-justified spots (ADR-0008): **Mid-Range is split by `SHOT_ZONE_RANGE` into 8–16 / 16–24 ft**, and the **corner-3s are split left/right** (from `SHOT_ZONE_AREA`). `SHOT_ZONE_RANGE` is otherwise dropped from primary evaluation.

**Zone rollup**:
Rolling the `LeagueAverages` frame (delivered at fine grain) up to the evaluation grain by **summing FGM and FGA per target zone and re-dividing** — never by averaging sub-zone FG%s. A correctness invariant: averaging rates across unequal-volume sub-zones yields a silently wrong baseline. Guarded by a reconciliation test.

**Secondary corner split**:
A left/right corner-3 view (from `SHOT_ZONE_AREA`), shown only when both corners individually clear the volume threshold — surfaces "left corner lover" insights when the data supports them, silent otherwise. **Ships for the launch hero** (both corners clear: L49 / R34); per-corner making carries the small-sample flag.

**Long two**:
A long mid-range two-pointer (~16–24 ft) — the lowest-value shot on the floor. The characteristic way a young wing's selection goes wrong. **Resolved for the launch hero (ADR-0008):** ~46% of his mid-range is long-two (33 attempts in 2025-26, clearing ≥15), so the Mid-Range range split ships. The purpose is *selection transparency*, not a making indictment — his long-two make rate (~45%) is fine; the point is to show how much of his diet sits in the lowest-value band.

**Shot selection** (a.k.a. **shot quality**):
The expected value of the *zones a player chooses to shoot from* — is he hunting high-PPS shots? Outcome-independent. Answers "is he taking good shots?"
_Avoid_: using "shot quality" to mean whether shots went in.

**Shot making**:
A player's *conversion relative to the zone baseline* — does he beat league expectation in the zones where he shoots? Answers "is he actually good?" Distinct from shot selection.

**Shot diet**:
The distribution of a player's shot attempts across zones — his attempt share per zone. The raw material of shot selection.

**Attempt share** (a.k.a. **zone frequency**):
The fraction of a player's (or the league's) shots taken from a given zone. Derived from FGA per zone in the shot data / `LeagueAverages` frame. A player's per-zone attempt shares are noisy in a single player-season; the league's are stable (large N), which is why the league is the benchmark and not the reverse.

**Diet-weighted expected PPS**:
The headline selection number: a player's zone attempt shares weighted by each zone's *league* PPS (his making held at league level, isolating selection). Compared against the same weighting applied to the *league's* zone shares — so the benchmark is the league's own diet, never an arbitrary fixed bar.

**Selection benchmark**:
The league-average shot mix. Shot selection is always framed as "vs league average," never "vs positional peers." The comparison is deliberately position-blind (see ADR-0002); position/archetype-adjusted selection is a v2 concern. The tool states its comparison class plainly. Excludes Backcourt heaves (nominal 3-zones with ~0 real value that would distort the weighting).

**Derived payload** (a.k.a. **the typed JSON contract**):
What Python persists and the frontend consumes: `{ enriched per-shot rows + rolled-up zone baseline }`, typed and Zod-validated at the load boundary. Notably it does *not* contain the headline metrics — those are computed from it. This payload is identical regardless of where player aggregation later runs, so the storage contract is not blocked on the compute-location question.

**Aggregation function**:
The single pure function that computes v1's player-side metrics (diet-weighted PPS, making deltas, suppression) over an array of enriched shots. v1 calls it once with all shots — the all-pass case of the filtered subsets v2 will pass. Its language (Python or TS) is deliberately deferred (see ADR-0007); as a pure, tested unit it ports either direction as a contained rewrite, not an architecture change. Its exact contents depend on data-dependent calls (mid-range split, corner split, zone set) not yet resolved.

**v1 thesis**:
"Is this player taking good shots?" — answered completely by the two-axis model (shot selection + shot making). This is the whole of v1's claim; the tool states this question and no more.

**v2 thesis**:
"How does he create his shots?" — the scheduled second act. Designated engine: the Case 2 buckets (catch-and-shoot vs pull-up, contested, shot-clock). Stretch: assisted/unassisted via Case 3 play-by-play reconstruction.

**Shot creation**:
Assisted/unassisted + catch-and-shoot/pull-up + clock/contest context. Explicitly v2, Case 2/3-powered. v1 has *no* creation signal — a catch-and-shoot and a pull-up from the same spot are identical dots in `shotchartdetail` — and must never imply otherwise (see ADR-0005).

**Shot spine**:
The v1 build increment: pull `shotchartdetail` for one player/one season, validate and enrich each shot into a typed shape, render it on a half-court. Descriptive only. Ships combined with the zone-baseline evaluation layer — the bare descriptive version is an internal checkpoint, not a shipped product.

**Raw artifact**:
One verbatim blob of a `shotchartdetail` response (player shots + `LeagueAverages` frame), stored exactly as returned. Keyed per **(player, season, pull-date)**. Self-describing: records at minimum its pull-date and games-included (or date-range), so a blob's contents are knowable without re-deriving.

**Pull unit**:
The season — not the game. `shotchartdetail` returns a whole player-season per response; there is no "game N" mode in v1. (Per-game pulls return in v2 for Case 3 play-by-play, where per-game *is* the endpoint's unit.)

**Snapshot**:
A single dated raw pull for a (player, season). A completed season has exactly one; an in-progress season accrues several.

**Season state**:
Whether a season is **completed** (immutable — pulled once, one snapshot; the whole of v1's storage behavior) or **in-progress** (mutable — re-pulled on demand, each pull a new dated snapshot, never overwriting).

**Append-only raw layer**:
The raw storage layer is append-only from day one: new snapshots are added, never overwritten. Derived data recomputes from the latest snapshot for a (player, season). v1 does *not* build snapshot-selection, re-pull scheduling, or diff/merge logic — with one completed-season snapshot, "latest" is trivial. The key carries pull-date so the later live-season demo needs no storage refactor; the machinery that consumes multiple snapshots is deferred until that demo needs it.

**Hero player**:
The single player a given deployment of the tool is focused on. The engine is player-agnostic; the hero player is a configuration/parameter, not a hardcoded assumption. Launch hero: **Cody Williams** (2024 Utah pick, has completed NBA seasons). Peterson (2026 #2 pick, no NBA shots until 2026-27) is the later "spin up cheaply" demo, not the launch subject.
_Hero ≠ good player._ Hero is the launch subject, nothing more. A debated/disappointing high-pick is the *better* subject: analyzing a known star mostly confirms the obvious, whereas the two-axis model (selection vs making) earns its keep on an open-question player by separating "chooses bad shots" from "chooses fine shots, misses them." Williams's disappointment is a feature of the subject. Only a Gate 2 (volume) failure should bump him — and then to another debated, higher-volume young Jazz player (e.g. Keyonte George), never to an established star.

**Launch season**:
The single season v1 renders for the hero. Chosen as the hero's highest-minutes completed season, to maximize the chance of clearing the volume gate. For the launch hero this is **2025-26** (1631 MIN vs 1060; 509 attempts vs 257; all 6 evaluation zones clear the volume bar).

**Hero eligibility**:
A player is eligible to be a hero only if they have ≥1 completed season passing both gates. Rookies/incoming players are ineligible until they do (see ADR-0003).

**Baseline gate** (Gate 1):
The `LeagueAverages` frame is populated for the season. Binary; fails for a season too recent/partial for the league table to be filled.

**Volume gate** (Gate 2):
The player has enough per-zone attempts that the mix view isn't mostly suppression warnings — constraint 4 (sample-size suppression) promoted from zone-level to player-level eligibility. **Threshold: a zone is included at ≥15 attempts** (all 6 evaluation zones clear for the launch hero/season; set from real counts per ADR-0003, now ADR-0008). There is *no* second hard cutoff on the making axis: low-N zones instead carry a **small-sample uncertainty flag** on the making delta. Rationale from the data — a player's attempt *share* is stable by ~34+ attempts, but per-zone *conversion* is noisy there, so the selection/making axis split is real, not just anticipated.
