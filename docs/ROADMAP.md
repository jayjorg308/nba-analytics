# Roadmap

_Drafted 2026-07-12, at the close of v1. A living document: phases are ordered by
dependency and value-per-effort, not by calendar. Each phase repeats the v1
recipe — a data spine with a golden fixture, a pure metrics function, honesty
flags, authored-and-guarded copy — on a new axis._

## Status — updated 2026-07-23

| Phase | State |
| --- | --- |
| v1 — the two-axis argument | ✅ shipped (ADRs 0001–0021) |
| v1.1 — close-out polish | ✅ closed 2026-07-12 (`hero:report`, the hero directory, display-grain rounding — ADRs 0022–0023) |
| v2.0 — creation at the bucket grain | ✅ built 2026-07-15 (ADRs 0029–0031 + amendments): contract, metrics, the SHOT CREATION second act, why-sentences + the tripwire flip |
| v2.1 — creation: defender distance (fast-follow) | ✅ built 2026-07-16 — third family (schema v2), Tight/Open/Wide-open product grain, 'contested' vocabulary graduated to backed |
| v2.5 — creation at the shot grain | ✅ built 2026-07-16 (ADRs 0032–0050): official assisted-make context for all three heroes; estimated shot clock gated out |
| v2.6 — the line (free throws at trip grain) | ✅ shipped 2026-07-21 (ADRs 0053–0056): contract, league pull, metrics + report, THE LINE act + four-payload sync, guarded line-sentences + lexicon graduation + fourth deployed-pair guard |
| v3 — living seasons | ✅ machinery proven 2026-07-23 (ADRs 0057–0059; replay oracles exact; activation = October config flip) |
| Season-over-season | ✅ built 2026-07-23 (ADRs 0060–0062): per-season pages live, growth coda ships dark, first instance at Ace's flip |

> **Directory-less by choice (confirmed 2026-07-16):** Cody Williams,
> Keyonte George, and the Shai Gilgeous-Alexander positive-control profile are
> registered, and argless `hero:sync` covers all three — while
> the hero index stays hidden: the root serves Cody directly, unknown paths
> fall back to him, and the "All players" footer link stays commented. The
> restore, when the Cody page is deemed done, is a grep for
> `TEMPORARY(single-hero)` in `src/App.tsx` + `src/app/HeroPage.tsx`.
>
> _The max-FGA stress test is now a shipped v2.5 commitment: Shai's 2025-26
> MVP season is the positive control. His action banner, guarded copy, and all
> three required payloads are production data; he receives no payload, gate,
> or guard exemption. The original action artwork is intentionally retained
> as a stylized production illustration, not a documentary game photo._

**Where v1 ended:** the thesis ("Is this player taking good shots?") is
answered by the two-axis model, argued verdict-first (ADR-0018), guarded
(golden contract, palette, verdict claims, drift, zone agreement), deployed as
one argument per hero (main = Cody Williams; `hero/keyonte-george` = the
mirror-image second hero that validated the player-agnostic engine), and gated
by CI on every push. ADRs 0001–0019 record how it got here.

---

## v1.1 — Close-out polish

1. **Wording pass** over verdicts and copy. Standing rule: any verdict edit
   runs `npm test` — the claims guard (ADR-0017) is the copy editor.
   _Done 2026-07-11._
2. **`npm run hero:report`** — print a hero's computed story from a derived
   payload: the decomposition (league diet + selection Δ + making Δ = actual
   PPS), the combined-threes rollup, per-zone bins and flags, gate results.
   Every hero swap starts by reading this; the verdict is written from it.
   _Done 2026-07-11: `scripts/hero-report.ts` under tsx, reusing the
   production parse + aggregation (ADR-0009 — never a second implementation)._
3. **Hero index page** — the site root: a directory of poster tiles linking
   the hero pages, all served by one deployment (a hero registry in
   `src/heroes/` + real URLs per hero — ADR-0022 supersedes the
   branch-per-hero model this item originally assumed). A directory of
   arguments, deliberately not a switcher (ADR-0018): each hero stays a
   complete argument at its own URL.
   _Done 2026-07-11. Keyonte George registered 2026-07-12 — the re-add path
   (`hero:report` → verdict + colocated guard + photo → registry entry +
   `hero:sync`) ran end to end on the first try; the retired
   `hero/keyonte-george` deployment branch remains as reference._

## v2.0 — Creation at the bucket grain (the Case 2 engine)

_The v2 thesis: "How does he create his shots?" The honest constraint: NBA
tracking dashboards arrive pre-aggregated (catch-and-shoot vs pull-up,
shot-clock buckets, closest-defender range), so this is a **parallel typed
payload**, not columns joined to the shot rows._

1. **Spike before building.** One local pull of the tracking splits for both
   heroes; validate shapes and volumes; pick the bucket vocabulary that ships
   (likely catch-and-shoot/pull-up + shot clock first, defender distance
   second; dribbles/touch-time mostly duplicate the first split). Run a
   domain-modeling session to pin the terms (*creation context*, *creation
   diet*) before code.
   _Done 2026-07-15: terms pinned + design recorded (ADRs 0029–0031), then
   `ingestion/pull_tracking.py` pulled both heroes + the league. General
   identity exact (509; 881 incl. the ADR-0019 drop), shot-clock gap zero,
   literal traps catalogued, shot-clock product grain set at three bands —
   closures recorded in ADR-0030._
2. **Ingestion mirrors the v1 spine**: append-only raw pulls (same keying,
   same local-only constraint — stats.nba.com blocks cloud IPs), a derive
   step, a second typed contract with its own golden, and the reconciliation
   guard this data begs for: **Σ bucket FGA must equal the shot payload's
   season FGA** (the ADR-0004 pattern, extended cross-payload).
3. **Creation speaks PPS, not eFG%.** Buckets mix 2s and 3s, but the
   dashboards carry the 3PT splits, so true PPS per bucket is computable —
   one value unit across the whole product (ADR-0001).
4. **Relax ADR-0005 formally.** A new ADR supersedes the creation boundary:
   creation claims are allowed if and only if they cite Case 2 buckets. The
   verdict guard's lexical tripwire flips from "forbidden vocabulary" to
   "vocabulary that must be backed by a bucket assertion."
5. **Presentation**: a creation panel below the two-axis headline blocks
   (context diet vs league, PPS by context), and the verdict grows its *why*
   sentence — the extension ADR-0018 anticipated.

_Items 2–5 done 2026-07-15 (ADRs 0029–0031 + amendments). The build taught
two presentation lessons, both recorded on ADR-0031: the NBA's General
taxonomy renders two-tier (rim vs jumpers), and the section's chart encodes
VALUE (a PPS dumbbell per context), not diet — the diet cut restates the
zone story. The verdicts now close with guarded why-sentences (Cody: the
catch-and-shoot collapse behind "cold from three"; George: the pull-up-heavy
diet behind his selection cost)._

## v2.1 — Creation: defender distance (the fast-follow)

_Deliberately cut from v2.0 (ADR-0030) to keep the first creation panel from
becoming a dashboard. The player-side tables (`ClosestDefenderShooting` /
`ClosestDefender10ftPlusShooting`) are ALREADY in every raw tracking
snapshot — the increment is: league pull extension (CloseDefDistRange
filtered calls) → creation schema v2 → golden regen → a third family in the
aggregation (likely a Tight/Open product rollup, the clock-band pattern) →
a third group in the chart and table. Payoff: the catch-and-shoot story
tightens to "wide-open threes, measured" — and the 'contested'/'wide open'
vocabulary moves from the guard lexicon's unshipped list to the backed list._

_Done 2026-07-16, exactly as scoped above. The family partitions the season
EXACTLY for both heroes and league-wide (zero unattributed everywhere), and
the filter literals match the row literals — no case traps. The payoff row
delivered: the launch hero produces 0.880 PPS on 117 wide-open attempts
against a league 1.178, while his tight/open bands sit at league — the value
leaks precisely where nobody is guarding him, corroborating the
catch-and-shoot story from independent tracking data (anchored in
creationPayload.real.test.ts)._

## v2.5 — Creation at the shot grain (the Case 3 stretch)

_The scope: reconstruct official assist credit at the shot grain, join it to
the existing dots by exact shot identity, and show the zone × assisted-makes
cross. Estimated shot-clock remaining is an independently gated experiment,
not a release dependency. Case 3 does not identify Case 2 catch-and-shoot,
pull-up, or Other contexts per shot (ADRs 0032–0034)._

All work covers the three registered heroes: Cody Williams, Keyonte George,
and Shai Gilgeous-Alexander. Shai's 2025-26 MVP season is the positive
control—the engine explains elite success with the same contracts, gates,
and guards used for the two young-player arguments.

_Built 2026-07-16. The completed-season source changed deliberately to paired
`PlayByPlayV3` / `BoxScoreTraditionalV3` artifacts after the live-data CDN
returned HTTP 403 (ADR-0050). The launch audit covered 146 unique games, 184
hero-game references, and all 2,710 post-drop shots: every shot joined exactly,
every team assist total reconciled, and no context remained unknown. The Stats
V3 source does not preserve enough possession/reset state for the exact
six-band clock gate, so estimated clock was omitted without delaying assists._

### Phase 0 — Raw spine and real-data spike

1. Add a per-game pull over the shot snapshot's unique game IDs. Store the
   verbatim NBA Stats `PlayByPlayV3` response once at
   `data/raw/play-by-play/<game-id>/<pull-date>.json`, shared by every hero in
   that game (ADR-0045). Pair it with the verbatim
   `BoxScoreTraditionalV3` response as a validation artifact (ADR-0046/0050).
   Both are append-only; completed games
   normally have one snapshot, and a corrected re-pull adds a dated snapshot.
2. Pull every game for all three heroes. Gate 4 requires a valid canonical
   play-by-play artifact for every game containing a hero shot; there is no
   silent fallback to another feed (ADRs 0044/0050; ADR-0035 superseded).
3. Produce an audit before fixing the schema:
   - confirm `gameId + gameEventId` ↔ `gameId + actionNumber`;
   - cross-check player, period, game clock, result, and point value;
   - catalogue missing, duplicate, contradictory, and assist-ambiguous cases;
   - discover whether structured assist credit is stable, otherwise fix a
     narrow versioned grammar for explicit scorer credit;
   - reconcile parsed assists exactly to each team's official box-score total;
   - record any structured assister identity without adding it to v2.5 scope.
4. Run the shot-clock experiment as a separate branch. Reconstruct the
   pre-drop season, roll it into the NBA's six Case 2 bands, and require exact
   FGA / FGM / 2PT-make / 3PT-make equality in every band for all three heroes
   (ADRs 0034/0047). If any hero fails, close the branch and omit estimated
   clock from the v2.5 schema and UI; assist work continues unchanged.

**Spike exit:** all three heroes pass the game-level source gate; the exact
join, assist evidence grammar, box-score reconciliation, and failure taxonomy
are established; the global clock branch has a recorded pass/fail decision.

### Phase 1 — Third contract and derive

1. Add the required metric-free **shot context payload**, with its own schema
   version and golden. It is a sibling of—not an extension to—the Case 1 shot
   payload and Case 2 creation payload (ADR-0032).
2. Make the contract total: exactly one row per post-drop shot with an
   identical shot-key set (ADR-0039). Each normalized row carries:
   - shot identity;
   - event-match status: matched / missing game / missing event / duplicate /
     contradiction;
   - assist status: assisted / unassisted / not applicable / unknown;
   - evidence kind and typed failure reason;
   - estimated shot-clock remaining only if Phase 0 passed its global gate.
3. Keep event linkage and assist classification independent (ADR-0040): a
   miss is assist-not-applicable even when its event is missing, while an
   exact event match may still have ambiguous assist evidence.
4. Deploy normalized facts only (ADR-0048). Raw event prose, action objects,
   parser captures, and box-score rows remain in raw artifacts and audit
   output. Assister IDs/names and teammate breakdowns are deferred.
5. Enforce exact joins with no nearest-event rescue (ADR-0036), exact sibling
   key-set reconciliation, complete source provenance, and the per-game
   assist-total invariant before persisting.

**Contract exit:** Python derives the golden byte-for-byte; Zod strict-parses
the same golden; mismatch/failure fixtures cover every event and assist state;
all three real hero payloads derive and reconcile.

### Phase 2 — Pure metrics and report-first authoring seam

1. Add one pure TypeScript aggregation over the shot payload plus its context
   sibling. Presentation receives its output and computes no shares, bounds,
   joins, or rollups.
2. Emit all-makes and existing-zone-hierarchy rows: the six evaluation zones,
   established mid-range/corner refinements, and combined 3 Pointers parent.
   Per row carry makes, assisted, unassisted, unknown, classified coverage,
   classified assisted share, and minimum/maximum share over all makes.
3. Add the Case 3 section to `hero:report` before UI work. Every verdict edit
   starts from this output, consistent with the existing hero-swap recipe.
4. Do not add a league baseline, confidence interval, or the conversion
   `<50 attempts` † flag. This is hero-season description; denominators and
   source-coverage bounds are its honesty mechanism (ADRs 0037/0038).

**Metrics exit:** hand-computed golden tests cover complete and incomplete
coverage, bounds telescope correctly, unknowns can never become unassisted,
and broader parent claims remain aggregation-owned rather than UI-computed.

### Phase 3 — Assisted Makes product surface

1. Load the third payload as required hero data; any contract/load failure
   fails the page plainly, preserving one class of registered hero page.
2. Add a distinct **ASSISTED MAKES** subsection after the existing Case 2
   creation chart/table—not a third headline or third act (ADR-0042).
3. Render a neutral 0–100% bounded-share dot plot plus accessible table
   (ADR-0043). A dot shows the classified share; unknown makes create the
   min–max coverage interval. The interval is not statistical confidence, no
   facts are hover-only, and the table owns all counts, coverage, and bounds.
   Shipped presentation suppresses attempt-empty refinements and the redundant
   Unknown / Coverage / Bounds group at complete coverage; either reappears
   automatically when its data becomes informative.
4. Enrich made-shot tooltips with assisted / unassisted / unavailable status.
   Misses omit assist status. Add approximate shot-clock text only if the
   global Phase 0 gate passed.

**Surface exit:** desktop/touch/accessibility tests cover all states, the
making palette is never reused, the existing headline/court layout does not
shift, and every visible number comes from the pure aggregation plus
`src/format.ts`.

### Phase 4 — Copy, guards, and Shai productionization

1. Graduate assisted/unassisted from the unshipped lexicon to backed creation
   vocabulary. Add a shot-context claim type whose assertions consume the
   worst-case assist bounds; assist language becomes legal, not mandatory.
2. Keep or rewrite each hero's why-sentence according to whether Case 3
   materially sharpens the argument. A claim must hold across the entire
   unknown interval, not merely the classified subset.
3. Hard-guard the semantic boundary: unassisted means no official assist
   credit, never self-created, solo, or without teammate help (ADRs 0041/0049).
4. Replace Shai's placeholder banner with a production asset, author his
   positive-control copy from the full report, and add the same colocated
   verdict guard required of Cody and Keyonte.

### Phase 5 — Deployment and release gates

1. Extend argless `hero:sync` to copy all three required sibling contracts for
   Cody, Keyonte, and Shai; a partial sync fails.
2. Add deployed-payload guards: every registered hero has a context sibling;
   every deployed context strict-parses, matches its shot key set and
   provenance, aggregates, and matches the latest derived copy when present.
3. Regenerate and commit the Case 3 golden with every schema change. Keep the
   shot and Case 2 creation goldens byte-stable unless their own contracts
   genuinely change.
4. Run the full repository gate before calling v2.5 done:
   `python -m pytest ingestion -q`, `npm test`, `npm run lint`, and
   `npm run build`.

### Standing non-goals and honesty constraints

- Assisted share is a share of **makes**, never attempts.
- No Case 1 or play-by-play proxy labels a shot catch-and-shoot, pull-up, or
  Other (ADR-0033).
- No fuzzy shot-to-event joins, alternate-feed fallback, raw NBA prose in the
  deployed payload, passer analysis, or league Case 3 baseline.
- Unassisted is official scorer attribution, not proof of self-creation.
- Estimated shot-clock remaining is approximate even if its band
  reconciliation passes, and is absent everywhere if any hero fails the gate.

## v2.6 — The line (free throws at trip grain)

_The thesis made whole: scoring the shot chart cannot see. FT points are 14.3% /
26.4% / 25.5% of the three heroes' scoring (league 15.9%), and non-and-one
shooting fouls hide +8.8% / +15.2% / +16.1% more attempts than the shot payload
records — the current model literally cannot explain the MVP positive control.
Designed 2026-07-21 (grilling + domain-modeling session; ADRs 0053–0056, new
CONTEXT.md terms: trip, trip class, attempt-equivalent/add-on tiers,
shooting-foul/bonus/and-one trips, free throw payload, FTA rate, free-throw
conversion, FT points share, expected points per trip, free-throw section,
Gate 5, and the reserved future term "scoring attempt"). The likely eventual
destination — the scoring-attempt model that prices foul generation into the
headline decomposition ("Option B") — is deliberately unversioned: the trip
grain, the tiers, and the and-one shot identity keep it an aggregation +
presentation decision, never a schema bump._

**The spike is done.** The 2026-07-21 research session reconstructed every hero
free-throw trip from the committed Case 3 corpus (zero new game pulls needed):
all 1,111 hero FT events classified with zero unresolved, per-game FTM/FTA
exact against every box score, season totals exact against the league endpoint
(84/119, 337/378, 540/614). Dead end confirmed and recorded: the stats API
rejects the FTA/POSS_END_FT shot-chart context measures, so no zone source
exists for non-and-one drawn fouls — the denied attempt's point class (2 FT vs
3 FT) is the only recoverable value signal.

1. **Contract** — `derive_freethrow.py` over the existing corpus + Zod schema +
   golden pair #3 + the oracle battery (taxonomy totality, per-game box-score
   equality, and-one exact linkage — ADR-0053). Free-throw vocabulary enters
   the lexicon's unshipped list in this same PR.
   _Done 2026-07-21: every oracle exact on all three heroes' full corpora;
   one classification refinement — a made shot plus a flagrant is a flagrant
   trip (kind outranks the and-one heuristic; same add-on tier)._
2. **League totals pull** — `pull_league_totals.py` → append-only
   `data/raw/_league/<season>/totals/<date>.json`; one artifact serves the
   Gate 5 oracle and the league baseline (ADR-0054).
   _Done 2026-07-21: 582 player rows; Gate 5 exact for all three heroes
   (84/119 · 337/378 · 540/614); real payloads derived and strict-parsed._
3. **Metrics** — pure `aggregateFreethrowMetrics` (fourth single-call-site
   function; consumes the free-throw payload alone) + the `hero:report` LINE
   section. Report before UI; the verdict sentence is authored from it
   (ADR-0055 semantics: endpoint parity, both-cuts guard discipline, shared
   †/floor constants on FTA).
   _Done 2026-07-21. Authoring anchors: Cody generates below league (.234 vs
   .264) and converts below league (.706 vs .783, 3-of-10 on and-ones);
   Keyonte and Shai beat every league trip price they play for._
4. **The act** — `04 · THE LINE` after THE CREDIT: line-vs-floor dumbbell
   chart (points per trip vs league, zone-baseline PPS as reference
   ticks) + tier-grouped table twin (ADR-0056). The ADR-0051 kicker amendment
   ("shots" → "scoring") lands in this PR, appended to ADR-0051.
   _Done 2026-07-21 — with the `hero:sync` 3→4 extension and the three
   deployed `.freethrow.json` payloads pulled forward from step 5 (the page
   requires the payload; main stays green), and an ADR-0056 amendment from
   the polish pass: the season line renders as the visual column's stat
   coda, preserving the acts' shared top register (ADR-0026)._
5. **Copy and guards** — per-hero verdict decisions (a line-sentence is legal,
   never mandatory), lexicon graduation, and deployed-pair guards extended to
   the fourth payload (every registered hero has a deployed free-throw payload
   that strict-parses, matches its siblings' identities, and matches the
   latest derived copy). Full repository gate before calling it done.
   _Done 2026-07-21. All three heroes elected a line-sentence — Cody's
   extends the diagnosis (below-league generation AND conversion, "the line
   does not bail him out"), Keyonte's is the counterweight to his No ("the
   line softens the no"), Shai's completes the positive control (roughly a
   quarter of MVP scoring at the line) — each backed by FreethrowClaim
   assertions holding on both technical cuts (ADR-0055). The free-throw
   vocabulary graduated from the unshipped list to FREETHROW_LEXICON
   (ADR-0029's mechanism, third use; the unshipped list now holds only the
   reserved 'scoring attempt' term), and `freethrowPayload.real.test.ts` guards the
   deployed pair: strict-parse, pre-drop seasonFga identity, and-one
   made-shot linkage, Gate 5 corpus completeness, tier-partition coherence,
   derived-copy equality. Full gate green: pytest 70, vitest 291, lint,
   build._

## v3 — Living seasons

_Designed 2026-07-21 (grilling + domain-modeling session; ADRs 0057–0059,
new CONTEXT.md terms: reconciled frontier, frontier-anchored pull, pull
session, season loop, data commit, live flip, claim headroom, living season).
The definition of done: the living-season machinery proven end-to-end by
**replaying a completed season through the real loop** — so that when 2026-27
opens, activation is a config change, not a build. The forcing constraint the
whole design answers: pulls are local-only while the deployed data is a
committed git artifact, so daily freshness means a scheduled local
pull → derive → gate → commit → push chain (ADR-0057), publishing only at the
reconciled frontier (ADR-0058), flipping a live season onto a page only when
its gates pass (ADR-0059)._

_The decisions, locked: scheduled automation with auto-push data commits on
green and loud halts on red; the frontier rule (lag defers, contradiction
halts, no tolerances ever); Ace Bailey registers now on his completed 2025-26
(892 shots, every zone ≥56 attempts — a routine fourth add, not a thin-sample
case) and his page goes live for 2026-27; the 2026 rookie (Peterson) is the
mid-season stretch, born live at first gate-pass; guards never loosen for live
data (halt-and-rewrite mornings + claim headroom); frontier metadata in all
four payloads' `_meta` with four-way equality; the hero directory returns with
the Ace add. Cody, Keyonte, and Shai keep their completed 2025-26 arguments
untouched._

1. **Phase 0 — endpoint spike** (local, everything downstream depends on it):
   prove `DateTo` semantics exact on every cumulative source against
   completed 2025-26. Oracles: a `DateTo` shot pull equals the date-filtered
   rows of the full snapshot; a `DateTo` tracking pull's General family
   reconciles against the date-filtered shot count; league totals under
   `DateTo` reconcile against play-by-play-reconstructed frontier totals;
   the `LeagueAverages` frame's behavior under `DateTo` is established. If an
   endpoint fails, the frontier rule does not bend — that source's pull
   design changes (ADR-0058).
   _Done 2026-07-21, same day: every oracle exact at two frontiers
   (2026-01-15 and 2025-11-05, Cody 2025-26 — n=135 and n=8), `DateTo`
   inclusive of the frontier date's games, `LeagueAverages` respects
   `DateTo` (true as-of baselines), Gate 5's completeness proof works at
   frontier grain. One characteristic recorded: the league tracking
   dashboard undercounts official FGA (~0.37% season-final, present in the
   shipped v2.1 artifacts) — cross-source coherence checks compare like
   universes only. Closures in ADR-0058._
2. **Phase 1 — Ace Bailey, fourth hero**: play-by-play/box pairs for his 72
   games (Gates 4/5), all four payloads, ADR-0008 grain refinements re-run
   against his real counts, banner + verdict + colocated guard + registry
   entry — the standing add recipe. The hero directory restore ships in this
   PR (the `TEMPORARY(single-hero)` grep): with a fourth argument live, the
   single-hero root stops being a simplification and starts hiding product.
   _Done 2026-07-21. The shared corpus covered 71 of his 72 games (one new
   pull, via the new explicit `--game-ids` path — the ADR-0054 remedy made
   real); all five gates pass; both ADR-0008 refinements ship on his counts
   (long twos 127, corners 56/56). The add surfaced the first hero-side
   tracking gap (8 attempts, two characterized outage games) and forced the
   ADR-0030 exact-or-reported amendment + creation schema v3
   (`trackingShortfall`, pinned per hero by the real-data guard). His
   verdict is the third quadrant: selection is the problem (mid-range at
   double the league share, long twos at nearly triple), making essentially
   league; guarded why- and line-sentences ship with it. Directory restored;
   full gate green (pytest 72, vitest 315, lint, build); browser-verified
   at mobile and desktop._
3. **Phase 2 — frontier contract**: the coordinated four-schema `_meta` bump
   (`dataThrough`, `gamesIncluded`), goldens regenerated together; four-way
   frontier equality joins the derive-time and deployed-pair reconciliation
   batteries; the UI freshness line ("Through Jan 14 · 34 games", structural
   copy); the `hero:report` claim-headroom section (ADR-0059).
   _Done 2026-07-21. Shot v4 computes the frontier from its own rows (Zod
   verifies rows vs meta); creation v4 / context v2 / freethrow v2 copy it
   from the sibling at derive (a pre-frontier sibling hard-fails with a
   re-derive instruction); equality asserted at derive, at the load
   boundary (context ties gamesIncluded to gamesExpected), and at the
   deployed-pair guards. All four heroes re-derived + re-synced (Cody
   through 2026-04-12 · 62 games; Ace 72). The byline now carries the
   frontier on every page (one form, completed and living); hero:report
   prints it plus the closing CLAIM HEADROOM section (two-axis gaps, diet
   share ratios, creation PPS gaps, FT gaps on both cuts, each against the
   house bars). Gate green: pytest 73, vitest 315, lint, build._
4. **Phase 3 — the season loop**: one `season:update` command orchestrating
   pull session → frontier computation → derives → sync → full gate → data
   commit (ADR-0057); defer/halt semantics per ADR-0058; dark mode for
   pre-flip seasons; the Task Scheduler wrapper and halt notification.
   _Done 2026-07-23. `season.config.json` (committed, PR-only) carries the
   live seasons and the tracking-shortfall pin registry — now per GAME,
   because a mid-season frontier is only explained by pins at or before it;
   the deployed-pair guard reads the same file (one source of truth), and
   the coherence rule is: gap == pins → ok, gap > pins → retreat (lag
   defers), gap < pins → halt (contradiction — pinned outage attempts
   cannot come back). `ingestion/live_pulls.py` (frontier-anchored pulls,
   `T`-stamped append-only snapshots that sort after plain dates),
   `ingestion/season_update.py` (the orchestrator; pure decision helpers
   under pytest, including the interior-hole and doubleheader frontier
   cases), a no-change early exit (byte-identical discovery + deployed at
   candidate → one API call and done), `--as-of` as the Phase 4 replay
   hook, and `scripts/season-update.ps1` (Task Scheduler + halt toast).
   Proven on real data the day it was built: the unstarted 2026-27 season
   no-ops clean in dark mode; a pseudo-live session on completed Ace
   2025-26 settled its frontier through the pinned-shortfall path
   (884 + 8 == 892), ran all four derives and the full gate green, and
   stopped at `--no-commit` with `wouldCommit: true`; the rerun exited
   no-change before any anchored pull. Gate green: pytest 88, vitest 315,
   lint, build._
5. **Phase 4 — the replay proof** (v3's exit): drive the real loop against
   completed 2025-26 over a calendar of simulated frontier dates (Cody as
   primary replay hero — his corpus is fully committed). Oracles: every
   replay day exactly reconciled at its frontier; the gate-pass day fires the
   flip signal in the report; and the terminal identity — the final replay
   frame equals the committed completed-season payloads exactly.
   _Done 2026-07-23 — every oracle exact. `ingestion/season_replay.py`
   (committed; rerun before each activation) drove seven real sessions
   (2025-12-07 → the 2026-04-12 finale). Frontier exact and nothing
   deferred on all seven days; the gate story traced from committed truth:
   all six zones failing at ten games, only Mid-Range failing from February
   through 2026-03-11, first GATES PASS on exactly 2026-03-13 (Cody's 48th
   game — a data-determined flip day, and a live reminder that flip timing
   varies sharply by hero); terminal frame byte-equal to all four committed
   payloads modulo provenance (pull dates and source paths only). The
   machinery that will run 2026-27 reproduced the committed season from
   nothing but the endpoints and the loop's own code path. v3's definition
   of done is met: activation in October is a config change._

**Activation (October 2026, post-v3):** everything is pre-positioned —
`season.config.json` already carries Ace's 2026-27 in dark mode and the
loop already no-ops cleanly on the unstarted season. The checklist: rerun
the replay proof (`python ingestion/season_replay.py`), register
`scripts/season-update.ps1` with Task Scheduler (command in its header),
watch the dark reports, and ship Ace's flip PR the day the loop says
GATES PASS. The flip PR's recipe grew with season-over-season (ADR-0059
as amended, ADRs 0060/0061): append the 2026-27 season entry to his hero
module, move `canonicalSeason`, author the live verdict plus the first
growth-sentence from that morning's `hero:report` (GROWTH section +
claim headroom), declare the growth claims and graduate the growth
vocabulary from the unshipped lexicon, and flip dark→live in
`season.config.json` — his 2025-26 argument stays frozen at its
permalink, and the SEASON OVER SEASON coda lights up that day.
**Stretch:** Peterson's raw pulls begin when his season does;
his page is born live the day the gates first pass on real thin data — the
"spin up cheaply" demo CONTEXT.md always promised, now with the gates
firing for real.

## Beyond v3 — in priority order (reordered 2026-07-23, at v3 close)

1. **Season-over-season** — same hero, two seasons, the growth story.
   _Designed 2026-07-23 (grilling + domain-modeling session; ADRs
   0060–0062, new CONTEXT.md terms: season argument, canonical season,
   season permalink, growth, growth coda, growth claim, prior argued
   season). The forcing constraint held: ADR-0059's flip replaced a
   hero's completed argument, so Ace's rookie-season argument would
   vanish at his projected late-November flip. The decisions, locked:
   the hero-season becomes the page unit — every argued season a
   complete argument at a stable `/<slug>/<season>` permalink, `/<slug>`
   the canonical alias, the flip a pointer move that preserves the prior
   argument frozen verbatim (ADR-0060; registry grows ordered seasons[]
   + canonicalSeason, one index tile per hero). The growth story is the
   SEASON OVER SEASON coda on the canonical page, outside the numbered
   acts: growth is movement in the vs-league residuals (each season
   against its own league), scoped to the two-axis spine + zone grain,
   rendered iff a prior argued season exists, from flip day, no added
   maturity bar (ADR-0061). Form: a season-pair dumbbell per zone on the
   diet-share-gap axis over the spine stat line, full zone-grain table
   twin (ADR-0062). A new growth claim kind consumes both seasons'
   payloads and asserts the movement itself; growth vocabulary stages
   through the unshipped lexicon and graduates at the first authored
   growth-sentence. Ships dark — fixture-proven until Ace's flip, the v3
   pre-positioning pattern._

   The build, two PRs in the summer window:
   1. **Per-season pages** — registry seasons[]/canonicalSeason, nested
      routing + permalinks, per-season URL derivation and titles,
      sync/deployed-guards iterating hero × seasons, the prior-page
      forward link (dormant until a second season argument exists).
      Visible immediately; every existing hero is the one-element case.
      _Done 2026-07-23. Guards select their season argument explicitly
      (`seasonArgumentOf`), so a flip can never silently repoint frozen
      claims; a registry coherence test locks the seasons[] invariants
      (unique, ordered, canonical present). Gate green (pytest 88,
      vitest 328); permalink, alias, and unknown-season fallback
      browser-verified._
   2. **Growth machinery** — the pure growth aggregation, the SEASON
      OVER SEASON coda (dumbbell + stat line + table twin), the growth
      claim kind + unshipped lexicon entry, `hero:report` GROWTH +
      claim-headroom rows, fixture-driven component and guard tests.
      _Done 2026-07-23. aggregateGrowthMetrics is the fifth pure
      aggregation, with loud identity gates (same player, chronological
      seasons); the coda fetches only the prior shot payload (five
      payloads on a canonical two-season page); the dumbbell dot classes
      carry their documented second meaning (emphasis = current season);
      movement figures subtract as displayed (formatSignedGap,
      ADR-0023). Growth vocabulary staged in the unshipped lexicon;
      GrowthClaim defined for the flip PR's graduation. Proven dark:
      aggregation unit tests, the five-payload coda render + the
      contradiction path over fixtures, and a golden-fixture
      `hero:report --prior-file` smoke run. Gate green: pytest 88,
      vitest 337, lint, build._

   Ace's flip PR (November) authors the first growth-sentence and
   graduates the vocabulary — deliberately out of this feature's scope.
2. **Hero scaffolding** — a generator that drafts heroConfig + a guard
   skeleton from `hero:report` output. Four manual adds have earned it,
   and it makes the mid-season Peterson born-live add (the ADR-0059
   stretch) nearly free at the moment it is most valuable.
   _Designed 2026-07-23 (grilling + domain-modeling session; ADR-0063,
   new CONTEXT.md terms: season-argument scaffold, authoring tripwire).
   The decisions, locked: the scaffold unit is the SEASON ARGUMENT
   (`npm run hero:scaffold -- <slug> <season>` — a new hero module when
   absent, a seasons[] append when present; flip-PR bookkeeping stays
   human). Mechanical fields get real values — the player name from the
   payload's `_meta`, the thesis formula, the conventional banner path,
   an eager registry entry — and every authored field is a
   `TODO(scaffold)` sentinel: the tool drafts no verdict prose, no
   claim thresholds, no crop judgment, ever (ADR-0017's boundary,
   extended; claim headroom stays an authoring input only). The guard
   skeleton is structure only and lands as a per-season guard file
   (`<slug>.<season>.guard.test.ts`; the four existing guards migrate
   by rename, making ADR-0060's frozen-argument discipline physical).
   An authoring tripwire — one shared pure helper, adopted by every
   guard, running outside the payload skipIf — holds the repo red until
   every sentinel is replaced and every referenced banner asset exists,
   closing the previously unguarded broken-banner hole. Preconditions
   hard-fail (all four derived payloads must resolve); nothing existing
   is ever overwritten, no force flag. Tested as a pure emit core in
   `src/scaffold/` with structural unit tests plus a temp-dir
   dynamic-import integration test; deliberately no byte-golden — the
   repo gate verifies every real scaffold. Build not started._
3. **Archetype-adjusted selection** — deferred from v1 (CONTEXT.md, Selection
   benchmark). The first item that changes the comparison class, so it
   supersedes ADR-0002 deliberately or not at all. Hardest; last on purpose.
   Also the first item with any claim to a derive-side analytical index (see
   the not-to-do list's database line).

---

## The standing not-to-do list

- **No hero switcher.** One argument per page (ADR-0018/0022). Multi-hero is
  a directory of pages at real URLs — one deployment, plain links — never a
  dropdown over one page.
- **No creation inference from Case 1 data.** `ACTION_TYPE` stays quarantined
  in the raw layer (ADR-0005); creation claims are legal only when they cite
  shipped Case 2 contexts (ADR-0029). Case 3 assist claims use their own
  worst-case-bounds guard; vocabulary whose family has not shipped stays out
  of verdicts entirely.
- **No rate averaging.** Rollups sum makes and attempts, always (ADR-0004).
- **No loosened guards.** Palette, verdict claims, golden, drift: when a
  guard fails, fix the thing it guards — never the assertion (ADR-0014/0017).
- **No trip estimator.** The 0.44 coefficient and every successor are
  permanently forbidden; hero-side trips are exact, and where exact league
  data does not exist the product goes descriptive, never approximate
  (ADR-0053/0055).
- **No league-comparative trip-taxonomy claims** without a league-wide
  play-by-play corpus (ADR-0038's stance extended to trips; ADR-0055).
- **Technicals are never trips** and never evaluation — counted and reported,
  the backcourt pattern (ADR-0053).
- **Never guess a zone for a shooting-foul trip.** The denied attempt's point
  class is knowable (2 FT vs 3 FT); its location is not (ADR-0012/0019 ethos,
  ADR-0053).
- **No database in the product architecture.** The storage story is files:
  append-only verbatim raw blobs, regenerable derived JSON, committed
  deployed payloads fetched by a static app (ADR-0006/0010). No layer has
  the query, concurrency, or scale pressure a database solves — a live
  season adds ~250MB of local gitignored raw per year and four small
  committed files a day. If a league-scale corpus (archetype baselines, a
  league-wide play-by-play pull) ever needs real queries, the answer is a
  disposable derive-side index (DuckDB/SQLite over the raw layer) as a
  Python implementation detail — never the contracts, the deployment story,
  or the frontend seam.
- **No frontier tolerances.** "Within one game" is still a tolerance
  (ADR-0058): a living season publishes exactly reconciled through its
  frontier or not at all; lag defers, contradiction halts.
- **The automated commit class is data-only.** The season loop never commits
  code, copy, config, or guard changes (ADR-0057); a red morning is fixed by
  a human rewriting the guarded thing, never by the loop or by loosening the
  guard.
