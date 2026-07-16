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
| v2.5 — creation at the shot grain | ⬅ **next up** (play-by-play join; unlocks "assisted", the zone × creation cross, and per-shot bucket identification) |
| v3 — living seasons and heroes at scale | not started |

> **Directory-less by choice (confirmed 2026-07-16):** Keyonte George is
> deliberately registered — both hero pages are live at their URLs with full
> two-act arguments and guards, and argless `hero:sync` covers both — while
> the hero index stays hidden: the root serves Cody directly, unknown paths
> fall back to him, and the "All players" footer link stays commented. The
> restore, when the Cody page is deemed done, is a grep for
> `TEMPORARY(single-hero)` in `src/App.tsx` + `src/app/HeroPage.tsx`.
>
> _Near-term side quest: stress-test the v2 creation charts against the
> league's max-FGA stars — pulls + `hero:report` (and `--file` mode) work
> for unregistered players, no registry entry needed. Each experiment needs
> both pulls (`pull_shots.py` + `pull_tracking.py`), then both derives._

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

_Play-by-play reconstruction, joined to the dots by gameId + gameEventId.
Unlocks what buckets cannot: the zone × creation cross ("his corner threes
are assisted; his above-break threes are pull-ups"), per-shot possession
context in the tooltip (the 0.8-seconds-on-the-clock touchstone), the
"assisted" verdict vocabulary (the last unshipped lexicon tier —
ADR-0029), and per-shot bucket identification — e.g. naming which two shots
were George's held-catch "Other" threes, which bucket grain provably cannot._

Two honesty constraints, both flag-shaped like everything else here:

- Play-by-play records assists **only on makes** — so the stat is "assisted
  share of makes," never of attempts, and the UI must say so.
- Per-shot clock is reconstructed timing, not tracking data — approximate,
  and labeled as such.

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
  shipped Case 2 contexts (ADR-0029), and vocabulary whose family hasn't
  shipped stays out of verdicts entirely — today only "assisted", until v2.5.
- **No rate averaging.** Rollups sum makes and attempts, always (ADR-0004).
- **No loosened guards.** Palette, verdict claims, golden, drift: when a
  guard fails, fix the thing it guards — never the assertion (ADR-0014/0017).
