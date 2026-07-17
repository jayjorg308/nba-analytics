# Roadmap

_Drafted 2026-07-12, at the close of v1. A living document: phases are ordered by
dependency and value-per-effort, not by calendar. Each phase repeats the v1
recipe — a data spine with a golden fixture, a pure metrics function, honesty
flags, authored-and-guarded copy — on a new axis._

## Status — updated 2026-07-16

| Phase | State |
| --- | --- |
| v1 — the two-axis argument | ✅ shipped (ADRs 0001–0021) |
| v1.1 — close-out polish | ✅ closed 2026-07-12 (`hero:report`, the hero directory, display-grain rounding — ADRs 0022–0023) |
| v2.0 — creation at the bucket grain | ✅ built 2026-07-15 (ADRs 0029–0031 + amendments): contract, metrics, the SHOT CREATION second act, why-sentences + the tripwire flip |
| v2.1 — creation: defender distance (fast-follow) | ✅ built 2026-07-16 — third family (schema v2), Tight/Open/Wide-open product grain, 'contested' vocabulary graduated to backed |
| v2.5 — creation at the shot grain | ✅ built 2026-07-16 (ADRs 0032–0050): official assisted-make context for all three heroes; estimated shot clock gated out |
| v3 — living seasons and heroes at scale | not started |

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

## v3 — Living seasons and heroes at scale

1. **In-progress season machinery** — what the append-only raw layer was
   built for and v1 deliberately deferred: multiple snapshots per season,
   re-pull cadence, data freshness surfaced in the UI. The 2026-27 season is
   the forcing function.
2. **A rookie hero** (Ace Bailey's raw data is already pulled) — the first
   time the ADR-0003 eligibility gates fire for real on a live, thin sample.
3. **Hero scaffolding** — a generator that drafts heroConfig + a guard
   skeleton from `hero:report` output. Earn it after the third manual swap.
4. **Season-over-season** — same hero, two seasons, the growth story.
   Payloads are already per-season; this is mostly presentation.
5. **Archetype-adjusted selection** — deferred from v1 (CONTEXT.md, Selection
   benchmark). The first item that changes the comparison class, so it
   supersedes ADR-0002 deliberately or not at all. Hardest item here; last on
   purpose.

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
