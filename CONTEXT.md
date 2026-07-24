# nba-analytics

An interactive, shareable web tool that analyzes a single NBA player's shot selection. One "hero" player at a time, on a player-agnostic data/computation engine.

_The repository is `nba-analytics`; the **product is Good Shots** (nbagoodshots.com). That is the name the navbar wordmark carries and the only name product copy should use — the repo name is engineering's, not the reader's._

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

**Term popover** (a.k.a. **dictionary popover**):
The click-opened definition card behind jargon terms in structural copy (`Term` + the `src/app/glossary.ts` registry, ADR-0052): the term renders as a dotted-underline button in its sentence's own type; click/tap opens a viewport-clamped fixed card — ADR-0027's one-interaction-model, hover affordance only. Definitions re-present this glossary's Language entries in general-reader words — structural product copy, never per-hero claims or numbers, so they carry no verdict-guard obligations. **Prose wraps a term once, at its first reading-order mention** — repeat mentions stay plain (define, don't hand-hold); table column headers are the exception, staying uniformly wrapped per table because a table is a reference surface a reader lands in cold. Wrapped surfaces: headline subtitles, act descriptions, table column headers, creation row labels; the authored verdict stays unwrapped.

**Section title recipe**:
The one header treatment for the page's data sections: a caps title (typeset in the content, never `text-transform`) with 4px tracking, over a gray one-line description bound 4px below — the two headline cards and all four act headers (ZONE BY ZONE, SHOT CREATION, ASSISTED MAKES, FREE THROWS) use it, via one shared CSS rule (`.section-caption`, beside `.headline-banner h2` in `src/App.css`). Every act opens with this header full-width above a shared split layout — visual left, data twin right — under a numbered act kicker naming its cut of the same reconciled season of scoring — `01 · THE WHERE` / `02 · THE HOW` / `03 · THE CREDIT` (cuts of the shots: place, manner, credit) / `04 · THE LINE` (the scoring the shot record excludes) — structural copy that never changes on a hero swap (ADR-0051, as amended). Internal rhythm is a 4/16 scale: 4px binds a thing to its caption (title→subtitle, value→label), 16px separates blocks. Companion rule: dense UI text (cards, table cells, captions, notes) opts into `line-height: normal`, because `:root`'s `18px/145%` computes to a fixed ~26px line-height that inherits into everything — the single most common cause of "loose"-looking UI text here.

**Punctuation style**:
Product copy never uses em dashes — no rendered sentence (component copy, glossary definitions, authored hero copy) may contain "—" as prose punctuation; restructure with a colon, semicolon, comma, parentheses, or a new sentence instead. The rationale is voice: em-dash-laden prose reads as machine-written. The "—" **no-data placeholder** in data cells and court labels (`EM_DASH` in `src/format.ts`, the assisted-bounds dash) is a glyph, not prose, and stays. Internal docs and code comments are outside the rule.

**Abbreviation style**:
Product copy abbreviates without periods — "vs" (never "vs."), "lg" / "Lg share" / "PPS (lg)" — one form on every surface: headline cards, zone table, chart title, byline. "lg" is for space-constrained data labels only ("expected from lg diet", where the spelled-out word forces smaller type or a wrapped line); running prose always spells out "league". The zone table teaches "lg = league" before the reader needs it anywhere denser.

**Derived payload** (a.k.a. **the typed JSON contract**):
What Python persists and the frontend consumes: `{ enriched per-shot rows + rolled-up zone baseline }`, typed and Zod-validated at the load boundary. Notably it does *not* contain the headline metrics — those are computed from it. This payload is identical regardless of where player aggregation later runs, so the storage contract is not blocked on the compute-location question.

**Zone-point conflict**:
A raw shot row whose `SHOT_TYPE` (the scorer's point value — what the shot was actually worth) contradicts its coordinate-derived zone's point value; the NBA disagreeing with itself, typically a foot-on-the-line call. Unrepresentable at the evaluation grain (zone boundaries are point-value boundaries), so the derive step drops and counts it, and the UI reports the count whenever nonzero — dropped and reported, never guessed into a zone (ADR-0019).

**Matchup**:
A shot's game context from the hero's perspective: the opponent (team abbreviation) and whether the game was home or away. Resolved per shot at the derive step (ADR-0028) — the UI only formats it (ADR-0011), per abbreviation style: "vs OKC" at home, "@ PHX" away. Descriptive context only; evaluation (selection/making) never reads it.

**Deployed payload**:
The committed copy of the derived payload the app actually fetches: `public/data/<player-slug>/<season>.json`, refreshed by an explicit `npm run hero:sync` (ADR-0010) or, for a living season on a green day, by the season loop's data commit (ADR-0057). The third layer of the storage story — raw (append-only, gitignored) → derived (recomputed, gitignored) → deployed (committed). The app reads persisted JSON only; it never calls the NBA API (unofficial endpoint; blocks cloud IPs).

**Aggregation function**:
The single pure function that computes v1's player-side metrics (diet-weighted PPS, making deltas, suppression) over an array of enriched shots. v1 calls it once with all shots — the all-pass case of the filtered subsets v2 will pass. **Resolved (ADR-0009):** its language is TypeScript (`src/domain/aggregate.ts`), closing the call ADR-0007 deferred; as a pure, tested unit it ports back as a contained rewrite, not an architecture change. Its contents are fully specified by the ADR-0008 zone set.

**v1 thesis**:
"Is this player taking good shots?" — answered completely by the two-axis model (shot selection + shot making). This is the whole of v1's claim; the tool states this question and no more.

**Verdict**:
The few-sentence answer to the thesis, stated directly under the title — the answer before the evidence. Authored per season argument (hero copy is configuration, like the hero itself), never computed, and kept honest by committed claim guards (ADR-0017). Its creation why-sentence may use shipped vocabulary only when a matching claim is declared; Case 3 assist language became available in v2.5, free-throw line language in v2.6, and growth language with the growth coda (canonical verdict only — ADR-0061), each optional per hero and each requiring its own declared claim kind.

**Assist claim**:
An optional authored verdict assertion about assisted makes, backed by shot-context metrics and required to remain true across the full worst-case assist-share bounds. Shipping assist analysis licenses the vocabulary; it does not force every hero's verdict to use it.

**Free-throw claim**:
An optional authored verdict assertion about the hero's line (a line-sentence's backing), asserted against the free-throw aggregation's output and required to hold on both the with-technicals and without-technicals cuts against the league value (ADR-0055's both-cuts discipline). Shipping THE LINE licenses the vocabulary; it does not force every hero's verdict to use it.

**Hero banner**:
The page's poster-scale opening: a black-and-white action image of the hero player carrying the thesis question as the page's `h1` (kicker · question · "↓ the verdict" cue pinned to the banner's bottom edge as the scroll affordance), leading directly into the verdict — ADR-0018's question-first order at poster volume. Its content (image, per-layout focal points, optional `teamLogoPath` team-mark watermark for the wide layout's dark left column) is authored per hero in the hero's config module (`src/heroes/<slug>.ts`), like the verdict; the kicker is season-owned copy carried by each season argument, since it embeds the season string (ADR-0060); its treatment (grayscale filter, wide panel / narrow full-bleed layouts, the display face, the portrait full-viewport landing screen with its graded title zone and glyph halo) is product (ADR-0021, ADR-0020, ADR-0025). The committed image is always a web-sized derivative, never a full-resolution source. Team marks use a normalized 1024×1024 transparent canvas with a centered visible mark occupying 58–62% of the longest side; `ingestion/test_team_logo_assets.py` enforces that asset interface so one CSS slot styles every team without per-hero scale overrides.

**Hero index** (a.k.a. **the directory**):
The site root: the first registered hero as a full-width **headshot marquee** (registry order is the directory order — first place is the cover story) over a name-only rail of everyone else on file, each figure the player's standard NBA **headshot** (a transparent-PNG cutout on a controlled dark ground, `headshotPath` in the hero config, the committed `img/<slug>-headshot.png`) with the player's *name* as the copy — the directory answers *who is on file*; the action poster and the thesis stay the hero page's argument (ADR-0065). Each figure links its hero's canonical argument at its `/<slug>` alias (one entry per hero, however many season arguments it carries — ADR-0060), all served by one deployment (ADR-0022). A directory of *arguments*, deliberately not a switcher (ADR-0018): heroes are never view-state under one page, and navigation is plain full-page links (the marquee and rail, the site navbar's wordmark, plus each hero page's quiet "All players" footer link). Everything reads straight off the **hero registry** (`src/heroes/registry.ts`, the single source of hero truth — the index, router, sync script, and per-hero guards all consume it), so registering a hero is what publishes its face here. The marquee's meta eyebrow (team · number · season) is derived from the authored kicker (`indexMetaOf`), never authored twice.

**Site navbar** (a.k.a. **the wordmark**):
The one persistent chrome on every page (ADR-0065): a fixed bar carrying the site's name, **Good Shots**, as a plain anchor to the directory — transparent with halo-guaranteed ink over the poster banner (the bar is fixed, never in flow, so the portrait banner still owns exactly the first viewport — ADR-0025), gaining a blurred solid ground once scrolled. Deliberately nothing more: no hero list, no menu, no view state — a navbar dropdown would be the switcher ADR-0018 forbids. The wordmark sets in the sans face (ADR-0020: the display face stays at poster scale).

**Season argument**:
A hero-season shipped as a complete argument: its own page at its season permalink, an authored verdict with colocated guard claims, and all four deployed payloads. The unit of the directory — a hero is an ordered set of season arguments with exactly one canonical (ADR-0060). "Argued" is a real qualification: a season with data but no shipped argument (Cody's 2024-25) is not a season argument.

**Canonical season**:
The season a hero's `/<slug>` alias renders — the hero's current argument. Recorded explicitly in the hero's registry entry (`canonicalSeason`) and moved only by a flip PR (ADR-0059/0060); the season loop never touches it. The hero's directory entry links the canonical alias.

**Season permalink**:
The stable per-season URL `/<slug>/<season>`, existing from the day its season argument ships and never changing meaning afterward. `/<slug>` is the **canonical alias**: it renders the canonical season in place (never a redirect), and the flip moves which season that is (ADR-0060).

**Season-argument scaffold**:
The generated starting state of a season argument (`npm run hero:scaffold -- <slug> <season>`, ADR-0063): mechanical fields real (the slug, the player name read from the shot payload's `_meta`, the verbatim thesis, the conventional banner and headshot paths, the registry entry — a new hero module when absent, a `seasons[]` append when present), every authored field a `TODO(scaffold)` sentinel, and the season's guard file as structure only — empty claim arrays, no thresholds, nothing read from the payloads. Scaffolding removes transcription, never authorship: it drafts no verdict prose, no claim, no crop judgment (ADR-0017's boundary, extended). It hard-fails unless all four derived payloads resolve, never overwrites anything that exists, and leaves flip-PR bookkeeping (the canonical move, `season.config.json`, vocabulary graduation) human.

**Authoring tripwire**:
The guard test that keeps a scaffold unmergeable until authored (ADR-0063): one shared pure helper asserts that no `TODO(scaffold)` sentinel remains in any authored field and that every referenced image asset exists on disk — the banner photo, the directory's headshot (ADR-0065), and the optional team mark. It runs on clean clones (outside the payload `skipIf`) in every hero's guard — so an unauthored season argument, a forgotten photo, or a mistyped image path is a red suite, never a shipped page.

**v2 thesis**:
"How does he create his shots?" — the second act, shipped: Case 2 creation contexts at the bucket grain, three families (see Context family; ADR-0030 plus the v2.1 defender fast-follow). Stretch: assisted/unassisted via Case 3 play-by-play reconstruction (v2.5).

**Shot creation**:
Assisted/unassisted + catch-and-shoot/pull-up + clock/contest context. Case 2 tracking evaluates catch/pull-up, clock, and contest at the aggregate context grain; Case 3 play-by-play adds official assist status for made shots, but does not identify Case 2 tracking contexts per shot (ADR-0033). Approximate per-shot clock was independently gated and omitted from v2.5 (ADRs 0034/0047/0050).

**Creation context**:
The pre-aggregated category describing how a shot came to be — catch-and-shoot, pull-up, a shot-clock band. The unit of v2.0's creation evaluation, assigned by the NBA's tracking dashboards, never derived per shot. v2.5 adds official assist context at the shot grain without manufacturing any of these Case 2 labels.
_Avoid_: "bucket" in product copy — engineering shorthand for the same concept, fine in code and ADRs.

**Context family**:
One partition of a player's attempts along a single tracking dimension. Three ship: **General** (product grain: two-tier — inside 10 ft, where the NBA classifies no creation, vs **jumpers** 10 ft and out, the summed catch-and-shoot / pull-up / other parent whose children refine how the jumper was created — ADR-0031), **Shot Clock** (product grain: three bands — Early 24–15 / Average 15–7 / Late 7–0), and **Closest Defender** (v2.1; product grain: Tight 0–4 / Open 4–6 / Wide open 6+ ft, from the NBA's four distances). Finer grains always roll up by summing makes and attempts, never averaging rates. A family's contexts sum to the season's attributed attempts. Dribbles and touch-time are rejected as restating General (ADR-0030).

**Product grain**:
The grain a context family renders at, computed in the aggregation by summing makes and attempts from the finer grain the payload persists — never by averaging rates (ADR-0004), and chosen so every rendered band clears the small-sample bar (the combined-threes pattern, ADR-0016). The payload always keeps the NBA's grain, so retuning a product grain is an aggregation change, never a schema bump. Current product grains: General's two tiers (inside 10 ft / jumpers), Shot Clock's three bands, Closest Defender's three bands.

**Creation diet**:
A player's attempt shares across one family's creation contexts — the creation analog of shot diet, benchmarked against the league's creation diet (the selection benchmark's stance: position-blind, comparison class stated plainly).

**Creation payload**:
The second typed contract, parallel to the derived payload: per-family player contexts plus the rolled-up league creation baseline, metric-free, with its own schema version and golden (ADR-0030). Deployed beside the shot payload and required for every registered hero.

**Shot context payload**:
The third typed contract: exactly one normalized Case 3 context row for every post-drop shot, matched by shot identity. It carries statuses, evidence kinds, and typed failure reasons—not raw NBA event prose—while keeping Case 1 shots, Case 2 creation contexts, and Case 3 reconstruction separate.

**Shot identity**:
The exact cross-source identity of a shot: NBA game ID plus game event/action number. Time, location, player, and result confirm an identity match; similarity on those facts never creates one.

**Event match status**:
The Case 3 linkage state of a shot: matched, missing game, missing event, duplicate event, or contradictory event. It is independent of assist status because a miss can lack an event while still having no applicable assist question, and a matched make can still have ambiguous assist evidence.

**Assist status**:
A four-state classification of a shot: **assisted** or **unassisted** for classified makes, **not applicable** for misses, and **unknown** when a make cannot be matched or classified safely. Unknown is a coverage failure, never evidence that the make was unassisted.

**Unassisted make**:
A made field goal for which the official scorer credited no assist. It is not synonymous with self-created, solo, or without teammate help; assist credit measures one attribution rule, not the whole possession's creation.

**Assist evidence**:
An explicit official scoring credit attached to a made-shot event, supplied by a stable structured field or a narrowly parsed NBA event description. A prior pass, nearby event, or plausible basketball sequence is not assist evidence.

**Assist reconciliation**:
The exact per-team, per-game equality between assist credits parsed from play-by-play and the official `BoxScoreTraditionalV3` assist total. The box score validates the parser but never supplies or repairs a per-shot classification.

**Assist coverage**:
The share of made shots whose assist status is classified as assisted or unassisted. Unknown makes remain in the full made-shot denominator and bound the true assisted share rather than being silently discarded.

**Assisted share of makes**:
The observed fraction of classified made field goals credited with an assist for the stated hero-season. It has no league baseline or small-sample ability claim; visible denominators and worst-case source-coverage bounds carry its honesty.

**Assisted-make zone grain**:
The existing shot-zone hierarchy reused for assist analysis: all makes, the six evaluation zones with their established refinements, and the combined 3 Pointers parent. Thin child zones remain visible with their denominators, while authored claims use a broader data-supported parent grain.

**Estimated shot-clock remaining**:
The approximate time left on the shot clock when a shot occurred, reconstructed from Case 3 event timing, possession changes, and reset rules. It ships only when the reconstruction exactly reproduces the authoritative six-band tracking totals for every current hero, and is never presented without approximation language. The completed-season Stats V3 source adopted for v2.5 does not preserve enough possession/reset state to attempt that gate safely, so estimated clock is absent from the v2.5 contract and UI (ADR-0050).

**Creation PPS**:
Points-per-shot within a creation context, computed from that context's 2PT/3PT makes and attempts — creation speaks the same value unit as everything else (PPS, never eFG%).

**Unattributed attempts**:
Attempts a context family fails to cover *within the tracking universe* (the family's sum measured against the tracking Overall). Counted and reported whenever nonzero, never guessed into a context (ADR-0030). Distinct from the tracking shortfall, which is the source-level gap between the tracking Overall and the official season; a family disagreeing with its own source's Overall is corruption and hard-fails.

**Tracking shortfall**:
The measured size of a hero-season's cross-universe gap: pre-drop season FGA (official) minus the tracking Overall. Zero for every hero shipped before v3; 8 for Ace Bailey's 2025-26 (two characterized outage games — ADR-0030, as amended). Persisted in the creation payload, reported in the UI whenever nonzero, and pinned **per outage game** in `season.config.json`'s registry — one source of truth read by the deployed-pair guard (which asserts the season sum) and by the season loop's coherence check (which needs the per-game grain at mid-season frontiers). Pins are earned only by a characterized outage and move only by PR — the loop never auto-pins or auto-unpins (ADR-0058, as amended). A negative shortfall (tracking exceeding the official record) is contradiction, not outage, and hard-fails the derive. Context shares keep the official denominator, so a gapped hero's shares visibly sum short by exactly this reported margin.

**Shot creation section**:
The hero page's second act (ADR-0031): after the court and zone table close the two-axis argument, this section backs the verdict's why-sentence. Its visual is the **creation value chart** — a PPS dumbbell per creation context, his value vs the league's on one positional axis (no color scale, no tooltips; the making palette belongs to the making axis alone); the tiny 'Other' residual is table-only — a classifier gap, not a creation category, its attempts inside the jumper parent — and a charted context under the volume gate's 15-attempt inclusion bar draws only the league dot, the table carrying its numbers. The creation table is the accessible data twin and the home of the diet shares — deliberately not charted, because the diet cut largely restates the zone story. Both real jumper-kind rows (catch-and-shoot and pull-ups) carry the **three-arrival annotation** ("N of his M threes"), the bridge between the creation story and the zone table's three-point verdict — both slices shown so the split is verifiable, not one-sided; the tiny Other residual's threes stay in the total without a line of their own.

**Assisted makes section**:
The distinct Case 3 subsection at the end of the Shot Creation second act: hero-only assisted-make evidence by the established zone hierarchy. It never shares a chart or comparison language with the league-relative Case 2 creation contexts, and per-shot assist details remain available in the Shots view.

**Assisted-share plot**:
The Assisted Makes section's bounded-share dot plot: each zone's classified assisted share is a dot, and unknown makes widen a minimum-to-maximum interval over all makes. The interval represents source coverage only, not statistical confidence; the table is the complete numerical twin.

**Assisted-makes presentation**:
The Assisted Makes product surface suppresses the Unknown / Coverage / Bounds table group when every displayed row has complete classification, and restores the whole group when any unknown make exists. Attempt-empty refinement rows are omitted until data makes them informative. The underlying coverage metrics and worst-case bounds remain part of the domain and authoring contracts in both states (ADR-0043).

**Trip** (a.k.a. **trip to the line**):
The free throws awarded to a player from a single non-technical foul, shot as one visit to the line — the unit of free-throw analysis, reconstructed from play-by-play events. A trip carries its free-throw makes and attempts and a trip class recording how it arose. Technical free throws are never trips.

**Technical free throw**:
A free throw awarded for a technical foul, shot by a designated shooter rather than earned by the shooter's own play. Excluded from trips and from all free-throw evaluation; counted and reported whenever nonzero (the backcourt pattern). Real points, never evidence about shot selection or foul generation.

**Trip class**:
The classification of how a trip arose — shooting foul (two or three free throws), bonus, and-one, flagrant, away-from-play, transition take, clear path — assigned from the causing foul event, never guessed. Every trip carries exactly one class, the classes partition non-technical free throws, and each class belongs to one of two tiers: attempt-equivalent or add-on.

**Attempt-equivalent trip**:
A trip that ends the possession in place of a field-goal attempt: the shooting-foul trips and the bonus trip. The tier a future scoring-attempt model would add to the attempt denominator alongside FGA.

**Add-on trip**:
A trip whose points land on top of a scoring attempt or possession that already stands: the and-one trip (its made shot is a counted attempt) plus the flagrant, away-from-play, transition-take, and clear-path trips (the fouled team keeps the ball). Add-on free throws raise points scored without adding an attempt.

**Shooting-foul trip**:
A trip awarded for a foul on an unmade shot: a field-goal attempt the scorer never recorded, replaced by two or three free throws. The free-throw count is the only surviving record of the denied attempt's point class (two free throws for a two-point attempt, three for a three); no zone or coordinates exist for it.

**Bonus trip**:
A trip awarded for a non-shooting foul while the fouling team is in the penalty. Attempt-equivalent on possession semantics (the possession ends at the line) even though it is drawn away from the act of shooting; whether it speaks for shot selection is a copy decision the taxonomy deliberately leaves open.

**And-one trip**:
The single free throw attached to a made, counted field-goal attempt ("and-1" acceptable in data labels). The one trip class with a shot identity: its made shot exists in the shot payload, so and-one trips inherit that shot's zone.

**Free throw payload**:
The fourth typed contract: per-trip rows (trip class, free-throw makes and attempts, the and-one's shot identity) plus the technical free-throw count and the league free-throw baseline, metric-free, with its own schema version and golden. Deployed beside its three siblings and required for every registered hero.

**FTA rate**:
Free-throw attempts per field-goal attempt — the foul-generation headline, hero vs league on identical semantics: all free throws (technicals included, because league totals cannot exclude them) over pre-drop season FGA. Coarser than the trip taxonomy but exactly comparable; a generation claim must also survive the hero's own without-technicals cut.

**Free-throw conversion**:
Hero FT% against league FT% — the making axis's analog at the line, on endpoint-parity semantics: technicals included in numerator and denominator on both sides, because league totals cannot exclude them. Carries the shared small-sample flag on free-throw attempts; per-class conversion (an and-one's single free throw) flags early and often. A conversion claim must also survive the hero's own without-technicals cut.

**Scoring attempt**:
_Future vocabulary, reserved:_ a field-goal attempt or an attempt-equivalent trip — the denominator of the eventual widened decomposition that prices free-throw generation into shot selection. Recorded now so copy never improvises a synonym; no product surface may use it until that model ships, and its league comparison requires an exact league trip count (league-wide play-by-play), never an estimator. In verdicts the reservation is enforced: the term sits in the lexicon's unshipped list (ADR-0029's tripwire), forbidden regardless of claims.

**FT points share**:
The share of a player's (or the league's) points scored at the line, technicals included on both sides. Exact from box-score arithmetic; the plainest statement of how much scoring the shot chart cannot see.

**Expected points per trip**:
A trip's value at a stated conversion: two (or three) free throws times free-throw percentage. At league conversion a two-shot trip prices at more points than any zone on the floor — the number that lets copy weigh a drawn foul against a taken shot in the product's one value unit.

**Free-throw section** (a.k.a. **THE LINE**):
The hero page's fourth act (04 · THE LINE): the points his fouls created, on attempts the shot chart never counted. Its visual column carries the **line-vs-floor chart** — the creation act's dumbbell grammar on the points-per-attempt axis: points per trip for the two-shot and three-shot trip classes, his conversion vs the league's, with the league zone-baseline PPS drawn as labeled reference ticks so a trip's value reads against the floor's — over the **season line** (FTA rate, FT points share, free-throw conversion, each vs league) as a border-separated stat coda, so chart and table share the acts' common top register. The dot floor and the small-sample flag count free-throw attempts, at the shared constants. The table twin is the tier-grouped trip taxonomy, whose per-class statements stay hero-descriptive; classes the hero never drew are omitted until data arrives, with a charted class at zero disclosed in a note. No fifth headline card; a hero's verdict may add a guarded line-sentence, never must.

**Growth**:
Season-over-season movement in a hero's vs-league residuals — selection Δ, making PPS Δ, per-zone diet-share gap and making Δ — each season measured against its own season's league baseline, so league drift nets out (ADR-0061). Never movement in raw rates: a raw cross-season comparison conflates player change with league change.
_Avoid_: reading "growth" as necessarily positive — the coda shows movement in either direction; the authored growth-sentence says which.

**Growth coda** (a.k.a. **SEASON OVER SEASON section**):
The canonical page's closing cross-season section — deliberately outside the numbered acts, whose kickers name cuts of one reconciled season (ADR-0051); the coda is the one thing on the page that is not. Rendered iff the canonical season has a prior argued season, from flip day, with no added maturity bar (gate-pass is the bar; † flags and the frontier byline carry thin-sample honesty). Scope: the two-axis spine plus the zone grain, which also bounds what a growth-sentence may claim. Form (ADR-0062): a season-pair dumbbell per zone on the diet-share-gap-vs-league axis, over the spine movement as a border-separated stat line, with a table twin carrying both seasons' full zone grain. Structural copy only; it links the prior season argument.

**Growth claim**:
The claim kind backing a growth-sentence (the verdict's optional cross-season sentence): assertions consume both seasons' deployed payloads and assert the movement itself, never two static per-season facts a reader must subtract (ADR-0023's displayed-anchor discipline applies to the movement). Legal, never mandatory; canonical verdict only — the prior season's verdict stays frozen verbatim at the flip, present tense and all. On a living season growth claims move daily and live under claim headroom and halt-and-rewrite.

**Prior argued season**:
The growth coda's comparison side: the hero's most recent earlier season argument. Both sides of the comparison passed all five gates by construction — argued status is the gate provenance; an unargued season never qualifies, however its data looks.

**Shot spine**:
The v1 build increment: pull `shotchartdetail` for one player/one season, validate and enrich each shot into a typed shape, render it on a half-court. Descriptive only. Ships combined with the zone-baseline evaluation layer — the bare descriptive version is an internal checkpoint, not a shipped product. **Shipped (2026-07-09):** the chart landed together with the headline selection banner and per-zone making table (`src/chart/`, `src/app/`) — never bare; the zone-shading evaluation overlay (the **Zones view**) followed on `feature_ZoneShadingEval`.

**Raw artifact**:
One verbatim blob of a `shotchartdetail` response (player shots + `LeagueAverages` frame), stored exactly as returned. Keyed per **(player, season, pull-date)**. Self-describing: records at minimum its pull-date and games-included (or date-range), so a blob's contents are knowable without re-deriving.

**Raw play-by-play artifact**:
One verbatim NBA Stats `PlayByPlayV3` response for a completed-season game, stored once by game ID and pull date and shared by every hero who appeared in that game. It is the sole v2.5 Case 3 source; a missing game is an explicit coverage failure, never permission to substitute a different play-by-play feed silently (ADR-0050).

**Raw game-validation artifact**:
The verbatim NBA Stats `BoxScoreTraditionalV3` response paired with a raw play-by-play artifact. It is a reconciliation oracle for official game totals, not an alternate source of per-shot events.

**Pull unit**:
The source's natural response grain: a season for `shotchartdetail`, and one game for Case 3 play-by-play. A source response is stored whole rather than decomposed into an invented storage grain.

**Snapshot**:
A single dated raw pull for a (player, season). A completed season has exactly one; an in-progress season accrues several.

**Season state**:
Whether a season is **completed** (immutable — pulled once, one snapshot; the whole of v1's storage behavior) or **in-progress** (mutable — re-pulled on demand, each pull a new dated snapshot, never overwriting). An in-progress season a hero is designated live for is a **living season**: pulled daily by the season loop and published only at its reconciled frontier (ADR-0057/0058).

**Append-only raw layer**:
The raw storage layer is append-only from day one: new snapshots are added, never overwritten. Derived data recomputes from the latest snapshot for a (player, season). v1 does *not* build snapshot-selection, re-pull scheduling, or diff/merge logic — with one completed-season snapshot, "latest" is trivial. The key carries pull-date so the later live-season demo needs no storage refactor; the machinery that consumes multiple snapshots is deferred until that demo needs it.

**Source universe**:
The record system a measurement belongs to. **Official** sources are the scorer's record and agree with each other exactly (shot rows, the `LeagueAverages` frame, league season totals, box scores); **tracking** sources are the optical-tracking dashboards behind the creation contexts, which league-wide run slightly under the official record (~0.4% of 2025-26 FGA — real tracking gaps, present in the shipped artifacts). Every comparison stays within one universe: creation is tracking vs tracking; shots, free throws, and their baselines are official vs official; league-wide aggregates are never reconciled across universes. The one deliberate cross-universe seam is the hero-grain General identity — the hero's tracking total reconciles against his official pre-drop shot count: any shortfall is measured, persisted, and reported (the tracking shortfall), while tracking *exceeding* the official record is contradiction and hard-fails — which is what keeps a hero-side tracking gap loud instead of silent (ADR-0030/0058).

**Reconciled frontier** (a.k.a. **data-through**):
The latest game date at which every source for a hero-season is exactly coherent — the point all five gates and every cross-payload identity are asserted through, and the only point a living season may publish at (ADR-0058). Recorded in every payload's `_meta` (`dataThrough`, `gamesIncluded`): the shot payload computes it from its own rows, its siblings copy it, and the four must agree exactly. Surfaced on every hero page's byline ("through Apr 12, 2026 · 72 games") — one structural form for completed and living seasons. A source lagging beyond the frontier defers that game to the next pull session; a contradiction at or inside it halts the publish for a human.

**Frontier-anchored pull**:
A living-season pull of a cumulative source (shots, tracking, league totals) issued with the reconciled frontier as its date ceiling, so the stored artifact matches the publish unit exactly — the cumulative endpoints have no per-game grain, so the frontier is enforced at pull time, never by slicing after the fact (ADR-0058). The artifact records its date range, per the raw-artifact rule.

**Pull session**:
One dated local run of the season loop's acquisitions: play-by-play/box pairs first (their availability fixes the reconciled frontier), then frontier-anchored pulls of the cumulative sources. Append-only; a same-day retry appends a timestamped snapshot, never overwrites.

**Season loop**:
The scheduled daily pipeline that keeps a living season fresh: pull session → the four derives → `hero:sync` → the full repository gate, and on green a data commit pushed for deployment (ADR-0057). Its roster — which hero-seasons are live, and whether each runs dark or publishes — lives in `season.config.json`, changed only by PR. Runs on a dev machine (pulls are local-only; `npm run season:update`); any failure halts the publish loudly and notifies. For a pre-flip season it runs dark: pull, derive, report, publish nothing. An off-day session ends at the no-change early exit after one discovery pull.

**Data commit**:
The one automated commit class (ADR-0057): deployed payloads plus their freshness metadata, landed by the season loop on a green day, with the day's report (new games, headline deltas, gate results) in the commit message. Never code, copy, or configuration — everything else still travels by PR.

**Live flip** (a.k.a. **the flip**):
The human copy event that makes a living season the hero's canonical season: triggered the first day all five eligibility gates pass on the live data (Gate 2 read mechanically: every evaluation zone at or above the inclusion bar — the loop's "GATES PASS" report line is the starting gun), shipped as one reviewed PR carrying the new season argument's registry entry + authored verdict + guard claim mapping + the `canonicalSeason` move + the season's dark→live mode flip in `season.config.json` (ADR-0059/0060). A hero with no prior argument is born live at the flip; a prior season argument survives its hero's flip at its own season permalink, verdict frozen verbatim, gaining only the structural forward link — and the flip PR may author the first growth-sentence (ADR-0061).

**Replay proof**:
The season loop's pre-activation ritual (`ingestion/season_replay.py`): drive the real loop over a calendar of historical frontier dates against a completed season and hold it to oracles computed from the committed payloads — per-day frontier exactness and gate truth, the flip signal firing on exactly the boundary day, and the terminal frame reproducing the committed deployment byte-equal modulo the six provenance fields (pull dates and source paths; ADR-0058, closure). Real data through real endpoints; the calendar is the only fiction. First run 2026-07-23 (Cody 2025-26, every oracle exact — v3's exit); rerun before each season's activation.

**Claim headroom**:
The distance between a verdict-grade quantity and the house threshold bars (the neutral/material/strong PPS vocabulary, diet-share ratios, both-cuts free-throw gaps, growth movements — ADR-0061), reported by `hero:report`'s closing CLAIM HEADROOM section. The authoring aid for living-season verdicts (write claims with deliberate margin, since the payload moves daily) — an authoring input only, never a guard input; each hero's guard still declares its own thresholds with its own rationale, and guards stay exact (ADR-0059).

**Hero player**:
The single player a given hero page is focused on (one deployment now serves a directory of hero pages — ADR-0022). The engine is player-agnostic; the hero player is a configuration/parameter, not a hardcoded assumption. Launch hero: **Cody Williams** (2024 Utah pick, has completed NBA seasons). Peterson (2026 #2 pick, no NBA shots until 2026-27) is the later "spin up cheaply" demo, not the launch subject.
_Hero ≠ good player._ Hero is the launch subject, nothing more. A debated/disappointing high-pick is the *better* subject: analyzing a known star mostly confirms the obvious, whereas the two-axis model (selection vs making) earns its keep on an open-question player by separating "chooses bad shots" from "chooses fine shots, misses them." Williams's disappointment is a feature of the subject. Only a Gate 2 (volume) failure should bump him — and then to another debated, higher-volume young Jazz player (e.g. Keyonte George), never to an established star.

**Positive-control hero**:
An established elite player whose known-good outcome tests whether the same engine can explain success rather than only diagnose failure. Shai Gilgeous-Alexander's 2025-26 MVP season is v2.5's positive control and passes the same contracts, gates, and guards as every other registered hero.

**Launch season**:
The single season v1 renders for the hero. Chosen as the hero's highest-minutes completed season, to maximize the chance of clearing the volume gate. For the launch hero this is **2025-26** (1631 MIN vs 1060; 509 attempts vs 257; all 6 evaluation zones clear the volume bar).

**Hero eligibility**:
A player is eligible to be a hero only if they have ≥1 completed season passing the eligibility gates: baseline, volume, tracking, play-by-play, and free throw. Rookies/incoming players are ineligible until they do (see ADR-0003 and ADR-0044). On a living season the same five gates are evaluated daily through the reconciled frontier, and the first day they all pass triggers the live flip (ADR-0059) — a rookie's page is born that day, not on opening night.

**Baseline gate** (Gate 1):
The `LeagueAverages` frame is populated for the season. Binary; fails for a season too recent/partial for the league table to be filled.

**Volume gate** (Gate 2):
The player has enough per-zone attempts that the mix view isn't mostly suppression warnings — constraint 4 (sample-size suppression) promoted from zone-level to player-level eligibility. **Threshold: a zone is included at ≥15 attempts** (all 6 evaluation zones clear for the launch hero/season; set from real counts per ADR-0003, now ADR-0008). There is *no* second hard cutoff on the making axis: low-N zones instead carry a **small-sample uncertainty flag** on the making delta. Rationale from the data — a player's attempt *share* is stable by ~34+ attempts, but per-zone *conversion* is noisy there, so the selection/making axis split is real, not just anticipated. **The flag threshold is < 50 attempts** (`SMALL_SAMPLE_MAKING_ATTEMPTS`, `src/domain/constants.ts`; tunable): it must exceed 49 so per-corner making at L49/R34 carries the flag per ADR-0008, and at n=50 a ~40% shooter's FG% has a 95% CI of ~±13.6pp — noise-dominated.

**Tracking gate** (Gate 3):
NBA tracking data exists for the season (2013-14 onward), so the creation payload can be built. Added by v2.0 (ADR-0030): a registered hero ships both payloads, so a pre-tracking season cannot host a hero.

**Play-by-play gate** (Gate 4):
A valid canonical Case 3 artifact exists for every game containing a hero shot. Whole-game absence makes the season ineligible; individual event ambiguities remain explicit unknowns handled by assist coverage and bounds.

**Free-throw gate** (Gate 5):
The hero-season's reconstructed free-throw record reconciles exactly with its oracles: per game against the box score, and season-total against the league season-totals source. The season-total equality is the completeness proof that no free throw occurred in a game outside the play-by-play corpus; a failure names the missing game or the drifted grammar and is never tolerated as approximate coverage.
