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
A long mid-range two-pointer (~16–24 ft) — the lowest-value shot on the floor. The characteristic way a young wing's selection goes wrong. **Resolved for the launch hero (ADR-0008):** ~46% of his mid-range is long-two (33 attempts in 2025-26, clearing ≥15), so the Mid-Range range split ships. The purpose is *selection transparency*, not a making indictment — his long-two make rate (~45%) is fine; the point is to show how much of his diet sits in the lowest-value band. Band shares are stated on the **diet denominator** (share of all evaluation attempts, league compared on the same footing) — one denominator across the whole table, so parent and child rows sum.

**Shot selection** (a.k.a. **shot quality**):
The expected value of the *zones a player chooses to shoot from* — is he hunting high-PPS shots? Outcome-independent. Answers "is he taking good shots?"
_Avoid_: using "shot quality" to mean whether shots went in.

**Shot making**:
A player's *conversion relative to the zone baseline* — does he beat league expectation in the zones where he shoots? Answers "is he actually good?" Distinct from shot selection.

**Zones view**:
The court's **default** display mode (Zones / Shots toggle; the raw made/missed scatter is the secondary, look-closer view): the six evaluation-zone regions shaded by making delta (player FG% − league FG% per zone) on the **making scale**, titled "vs league average" (ADR-0002), with the scale's legend beside the toggle above the court. Display-only: it re-presents the same `ShotMetrics.zones[]` the table shows (no re-aggregation — ADR-0011), shades all six zones regardless of `included` (inclusion gates the mix view; making is flagged†, never suppressed — ADR-0008), and its drawn regions approximate the data's zone assignments without ever overriding them (ADR-0012). Each zone region is a real button: click/tap opens its **zone detail card**; hover is a visual affordance only (ADR-0027). The mid-range 8–16/16–24 band split stays table-only — no rings on the court.

**Zone detail card**:
The click-opened overlay covering the court (`ZoneDetailCard`) that carries one zone's full story — raw makes/attempts, FG% vs lg, PPS vs lg, diet share vs lg share, Making Δ (the gap of its two displayed FG% anchors — ADR-0023) with the small-sample sentence when flagged, and a mini making-scale bar marking the zone's bin. One interaction model on every device (hover tooltips are invisible to touch — ADR-0018/0027); dismissed by its close button, Escape, or the view toggle, and out of flow so opening it never shifts the page (ADR-0026). It only re-presents `ZoneMetricsRow` (ADR-0011), keyed by the clicked zone's name, never tap coordinates (ADR-0012). The home of raw FG% — the table deliberately has no FG% column (ADR-0018). The Shots view keeps a mouse-hover-only tooltip; on touch the scatter is view-only and the zone table is the accessible data twin.

**Making scale**:
The Zones view's binned diverging encoding of making delta: neutral gray band at ±2.5 pp around league average, symmetric warm (above) / cool (below) arms in 7.5 pp steps, open-ended past ±17.5 — edges are fixed absolute values so the same color means the same delta for every hero and season (ADR-0013). A zero-attempt zone renders unpainted (no data ≠ at league average), and the per-theme colors are governed by tested invariants — label contrast, monotone luminance, gray midpoint — not by fixed hexes (ADR-0014).

**Shot diet**:
The distribution of a player's shot attempts across zones — his attempt share per zone. The raw material of shot selection.
_Avoid_: "shot mix" in product copy — same concept, second name; diet is the product's word (headline labels, verdict copy, table caption).

**Attempt share** (a.k.a. **zone frequency**):
The fraction of a player's (or the league's) shots taken from a given zone. Derived from FGA per zone in the shot data / `LeagueAverages` frame. A player's per-zone attempt shares are noisy in a single player-season; the league's are stable (large N), which is why the league is the benchmark and not the reverse.

**Diet-weighted expected PPS**:
The headline selection number: a player's zone attempt shares weighted by each zone's *league* PPS (his making held at league level, isolating selection). Compared against the same weighting applied to the *league's* zone shares — so the benchmark is the league's own diet, never an arbitrary fixed bar. Surfaces in the UI as **"expected from his diet"** — deliberately the *same label in both headline blocks*, because the number is the hinge of the ADR-0016 decomposition: the output of selection (what his choices are worth) and the benchmark for making (what he should have scored from them). In UI copy, "expected" always means "at league-average shooting"; the making axis is described in prose as *conversion*, never bare "making".

**Making PPS delta**:
The headline making number: actual PPS minus diet-weighted expected PPS — what the player's conversion adds or subtracts with his diet held fixed (ADR-0016). Denominated in PPS (the whole-diet value consequence), unlike the per-zone making delta (FG% points, one zone's conversion); the headline numbers decompose exactly: league diet PPS + selection delta + making PPS delta = actual PPS. The identity also holds *as displayed*: any delta rendered beside its two anchors is the difference of the rounded anchors, never the rounded raw delta (ADR-0023).

**Combined threes**:
The three 3-point evaluation zones rolled up into one line by summing makes and attempts — player and league both, per the zone-rollup rule, never averaged rates. Exists so the making verdict can be stated at a grain the sample supports: each launch-hero 3PT zone is individually small-sample-flagged (49/34/48 attempts) while the combined 131 clear the bar (ADR-0016). Rendered in the zone table as the **3 Pointers** parent row over its three (child) zone rows (whose table labels drop the redundant "3": Left Corner / Right Corner / Above the Break); there is deliberately no paint or all-twos parent — RA vs non-RA is the value-critical distinction inside the arc, and a combined row would average across it.

**Selection benchmark**:
The league-average shot diet. Shot selection is always framed as "vs league average," never "vs positional peers." The comparison is deliberately position-blind (see ADR-0002); position/archetype-adjusted selection is a v2 concern. The tool states its comparison class plainly. Excludes Backcourt heaves (nominal 3-zones with ~0 real value that would distort the weighting).

**Section title recipe**:
The one header treatment for the page's data sections: a caps title (typeset in the content, never `text-transform`) with 4px tracking, over a gray one-line description bound 4px below — the two headline cards and the zone table's "ZONE BY ZONE" all use it, via one shared CSS rule (beside `.headline-banner h2` in `src/App.css`). Internal rhythm is a 4/16 scale: 4px binds a thing to its caption (title→subtitle, value→label), 16px separates blocks. Companion rule: dense UI text (cards, table cells, captions, notes) opts into `line-height: normal`, because `:root`'s `18px/145%` computes to a fixed ~26px line-height that inherits into everything — the single most common cause of "loose"-looking UI text here.

**Abbreviation style**:
Product copy abbreviates without periods — "vs" (never "vs."), "lg" / "Lg share" / "PPS (lg)" — one form on every surface: headline cards, zone table, chart title, byline. "lg" is for space-constrained data labels only ("expected from lg diet", where the spelled-out word forces smaller type or a wrapped line); running prose always spells out "league". The zone table teaches "lg = league" before the reader needs it anywhere denser.

**Derived payload** (a.k.a. **the typed JSON contract**):
What Python persists and the frontend consumes: `{ enriched per-shot rows + rolled-up zone baseline }`, typed and Zod-validated at the load boundary. Notably it does *not* contain the headline metrics — those are computed from it. This payload is identical regardless of where player aggregation later runs, so the storage contract is not blocked on the compute-location question.

**Zone-point conflict**:
A raw shot row whose `SHOT_TYPE` (the scorer's point value — what the shot was actually worth) contradicts its coordinate-derived zone's point value; the NBA disagreeing with itself, typically a foot-on-the-line call. Unrepresentable at the evaluation grain (zone boundaries are point-value boundaries), so the derive step drops and counts it, and the UI reports the count whenever nonzero — dropped and reported, never guessed into a zone (ADR-0019).

**Matchup**:
A shot's game context from the hero's perspective: the opponent (team abbreviation) and whether the game was home or away. Resolved per shot at the derive step (ADR-0028) — the UI only formats it (ADR-0011), per abbreviation style: "vs OKC" at home, "@ PHX" away. Descriptive context only; evaluation (selection/making) never reads it.

**Deployed payload**:
The committed copy of the derived payload the app actually fetches: `public/data/<player-slug>/<season>.json`, refreshed only by an explicit `npm run hero:sync` (ADR-0010). The third layer of the storage story — raw (append-only, gitignored) → derived (recomputed, gitignored) → deployed (committed). The app reads persisted JSON only; it never calls the NBA API (unofficial endpoint; blocks cloud IPs).

**Aggregation function**:
The single pure function that computes v1's player-side metrics (diet-weighted PPS, making deltas, suppression) over an array of enriched shots. v1 calls it once with all shots — the all-pass case of the filtered subsets v2 will pass. **Resolved (ADR-0009):** its language is TypeScript (`src/domain/aggregate.ts`), closing the call ADR-0007 deferred; as a pure, tested unit it ports back as a contained rewrite, not an architecture change. Its contents are fully specified by the ADR-0008 zone set.

**v1 thesis**:
"Is this player taking good shots?" — answered completely by the two-axis model (shot selection + shot making). This is the whole of v1's claim; the tool states this question and no more.

**Verdict**:
The few-sentence answer to the thesis, stated directly under the title — the answer before the evidence. Authored per hero (hero copy is configuration, like the hero itself), never computed, and kept honest by a committed guard test that asserts each directional claim against the deployed payloads' metrics (ADR-0017). Since v2.0 it closes with the **why-sentence** — the creation story behind the two-axis answer; creation vocabulary is allowed iff the guard declares a creation-kind claim (ADR-0029), and vocabulary whose data hasn't shipped (assisted, contested) stays forbidden.

**Hero banner**:
The page's poster-scale opening: a black-and-white action photo of the hero player carrying the thesis question as the page's `h1` (kicker · question · "↓ the verdict" cue pinned to the banner's bottom edge as the scroll affordance), leading directly into the verdict — ADR-0018's question-first order at poster volume. Its content (photo, per-layout focal points, kicker, optional `teamLogoPath` team-mark watermark for the wide layout's dark left column) is authored per hero in the hero's config module (`src/heroes/<slug>.ts`), like the verdict; its treatment (grayscale filter, wide panel / narrow full-bleed layouts, the display face, the portrait full-viewport landing screen with its graded title zone and glyph halo) is product (ADR-0021, ADR-0020, ADR-0025). The committed image is always a web-sized derivative, never a full-resolution source.

**Hero index** (a.k.a. **the directory**):
The site root: a directory of poster tiles — each hero's banner photo and thesis at tile scale — linking to the complete hero pages at their own URLs (`/<slug>`), all served by one deployment (ADR-0022). A directory of *arguments*, deliberately not a switcher (ADR-0018): heroes are never view-state under one page, and navigation is plain full-page links (the tiles, plus each hero page's quiet "All players" footer link). Tiles read straight off the **hero registry** (`src/heroes/registry.ts`, the single source of hero truth — the index, router, sync script, and per-hero guards all consume it), so registering a hero is what publishes its tile.

**v2 thesis**:
"How does he create his shots?" — the second act, shipped: Case 2 creation contexts at the bucket grain, three families (see Context family; ADR-0030 plus the v2.1 defender fast-follow). Stretch: assisted/unassisted via Case 3 play-by-play reconstruction (v2.5).

**Shot creation**:
Assisted/unassisted + catch-and-shoot/pull-up + clock/contest context. v2.0 evaluates it at the bucket grain through creation contexts; creation claims are allowed iff they cite Case 2 contexts (ADR-0029). Case 1 data still carries *no* creation signal — a catch-and-shoot and a pull-up from the same spot are identical dots in `shotchartdetail` — and must never imply otherwise (ADR-0005's quarantine stands).

**Creation context**:
The pre-aggregated category describing how a shot came to be — catch-and-shoot, pull-up, a shot-clock band. The unit of v2.0's creation evaluation, assigned by the NBA's tracking dashboards, never derived per shot at the bucket grain (per-shot creation is v2.5).
_Avoid_: "bucket" in product copy — engineering shorthand for the same concept, fine in code and ADRs.

**Context family**:
One partition of a player's attempts along a single tracking dimension. Three ship: **General** (product grain: two-tier — inside 10 ft, where the NBA classifies no creation, vs **jumpers** 10 ft and out, the summed catch-and-shoot / pull-up / other parent whose children refine how the jumper was created — ADR-0031), **Shot Clock** (product grain: three bands — Early 24–15 / Average 15–7 / Late 7–0), and **Closest Defender** (v2.1; product grain: Tight 0–4 / Open 4–6 / Wide open 6+ ft, from the NBA's four distances). Finer grains always roll up by summing makes and attempts, never averaging rates. A family's contexts sum to the season's attributed attempts. Dribbles and touch-time are rejected as restating General (ADR-0030).

**Product grain**:
The grain a context family renders at, computed in the aggregation by summing makes and attempts from the finer grain the payload persists — never by averaging rates (ADR-0004), and chosen so every rendered band clears the small-sample bar (the combined-threes pattern, ADR-0016). The payload always keeps the NBA's grain, so retuning a product grain is an aggregation change, never a schema bump. Current product grains: General's two tiers (inside 10 ft / jumpers), Shot Clock's three bands, Closest Defender's three bands.

**Creation diet**:
A player's attempt shares across one family's creation contexts — the creation analog of shot diet, benchmarked against the league's creation diet (the selection benchmark's stance: position-blind, comparison class stated plainly).

**Creation payload**:
The second typed contract, parallel to the derived payload: per-family player contexts plus the rolled-up league creation baseline, metric-free, with its own schema version and golden (ADR-0030). Deployed beside the shot payload and required for every registered hero.

**Creation PPS**:
Points-per-shot within a creation context, computed from that context's 2PT/3PT makes and attempts — creation speaks the same value unit as everything else (PPS, never eFG%).

**Unattributed attempts**:
Attempts a context family fails to cover (tracking gaps — e.g. shot-clock data missing). Counted and reported whenever nonzero, never guessed into a context; required to be zero for the General family, which must reconcile exactly with the shot payload's season attempts (ADR-0030).

**Shot creation section**:
The hero page's second act (ADR-0031): after the court and zone table close the two-axis argument, this section backs the verdict's why-sentence. Its visual is the **creation value chart** — a PPS dumbbell per creation context, his value vs the league's on one positional axis (no color scale, no tooltips; the making palette belongs to the making axis alone). The creation table is the accessible data twin and the home of the diet shares — deliberately not charted, because the diet cut largely restates the zone story. The catch-and-shoot row carries the **three-arrival annotation** ("N of his M threes"), the bridge between the creation story and the zone table's three-point verdict.

**Shot spine**:
The v1 build increment: pull `shotchartdetail` for one player/one season, validate and enrich each shot into a typed shape, render it on a half-court. Descriptive only. Ships combined with the zone-baseline evaluation layer — the bare descriptive version is an internal checkpoint, not a shipped product. **Shipped (2026-07-09):** the chart landed together with the headline selection banner and per-zone making table (`src/chart/`, `src/app/`) — never bare; the zone-shading evaluation overlay (the **Zones view**) followed on `feature_ZoneShadingEval`.

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
The single player a given hero page is focused on (one deployment now serves a directory of hero pages — ADR-0022). The engine is player-agnostic; the hero player is a configuration/parameter, not a hardcoded assumption. Launch hero: **Cody Williams** (2024 Utah pick, has completed NBA seasons). Peterson (2026 #2 pick, no NBA shots until 2026-27) is the later "spin up cheaply" demo, not the launch subject.
_Hero ≠ good player._ Hero is the launch subject, nothing more. A debated/disappointing high-pick is the *better* subject: analyzing a known star mostly confirms the obvious, whereas the two-axis model (selection vs making) earns its keep on an open-question player by separating "chooses bad shots" from "chooses fine shots, misses them." Williams's disappointment is a feature of the subject. Only a Gate 2 (volume) failure should bump him — and then to another debated, higher-volume young Jazz player (e.g. Keyonte George), never to an established star.

**Launch season**:
The single season v1 renders for the hero. Chosen as the hero's highest-minutes completed season, to maximize the chance of clearing the volume gate. For the launch hero this is **2025-26** (1631 MIN vs 1060; 509 attempts vs 257; all 6 evaluation zones clear the volume bar).

**Hero eligibility**:
A player is eligible to be a hero only if they have ≥1 completed season passing the eligibility gates (baseline, volume — and, since v2.0, tracking). Rookies/incoming players are ineligible until they do (see ADR-0003).

**Baseline gate** (Gate 1):
The `LeagueAverages` frame is populated for the season. Binary; fails for a season too recent/partial for the league table to be filled.

**Volume gate** (Gate 2):
The player has enough per-zone attempts that the mix view isn't mostly suppression warnings — constraint 4 (sample-size suppression) promoted from zone-level to player-level eligibility. **Threshold: a zone is included at ≥15 attempts** (all 6 evaluation zones clear for the launch hero/season; set from real counts per ADR-0003, now ADR-0008). There is *no* second hard cutoff on the making axis: low-N zones instead carry a **small-sample uncertainty flag** on the making delta. Rationale from the data — a player's attempt *share* is stable by ~34+ attempts, but per-zone *conversion* is noisy there, so the selection/making axis split is real, not just anticipated. **The flag threshold is < 50 attempts** (`SMALL_SAMPLE_MAKING_ATTEMPTS`, `src/domain/constants.ts`; tunable): it must exceed 49 so per-corner making at L49/R34 carries the flag per ADR-0008, and at n=50 a ~40% shooter's FG% has a 95% CI of ~±13.6pp — noise-dominated.

**Tracking gate** (Gate 3):
NBA tracking data exists for the season (2013-14 onward), so the creation payload can be built. Added by v2.0 (ADR-0030): a registered hero ships both payloads, so a pre-tracking season cannot host a hero.
