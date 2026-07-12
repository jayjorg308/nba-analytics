# Roadmap

_Drafted 2026-07-12, at the close of v1. A living document: phases are ordered by
dependency and value-per-effort, not by calendar. Each phase repeats the v1
recipe — a data spine with a golden fixture, a pure metrics function, honesty
flags, authored-and-guarded copy — on a new axis._

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
3. **Hero index page** — one static page linking the hero deployments. A
   directory of arguments, deliberately not a switcher (ADR-0018): each hero
   stays a complete argument at its own URL.

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

## v2.5 — Creation at the shot grain (the Case 3 stretch)

_Play-by-play reconstruction, joined to the dots by gameId + gameEventId.
Unlocks what buckets cannot: the zone × creation cross ("his corner threes
are assisted; his above-break threes are pull-ups") and per-shot possession
context in the tooltip (the 0.8-seconds-on-the-clock touchstone)._

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

- **No hero switcher.** One deployment, one argument (ADR-0018). Multi-hero
  is a directory of pages, never a dropdown over one page.
- **No creation inference from Case 1 data.** `ACTION_TYPE` stays quarantined
  in the raw layer until Case 2/3 can back the claim (ADR-0005).
- **No rate averaging.** Rollups sum makes and attempts, always (ADR-0004).
- **No loosened guards.** Palette, verdict claims, golden, drift: when a
  guard fails, fix the thing it guards — never the assertion (ADR-0014/0017).
