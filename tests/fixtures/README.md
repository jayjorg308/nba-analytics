# Cross-language golden fixtures

The committed handshake between the Python derive steps and the TypeScript
payload contracts (see ADR-0007, ADR-0030). `data/` is gitignored; these
fixtures are not. There are four independent golden contracts — the shot,
creation, shot-context, and free-throw payloads version on different clocks
(ADR-0030/0032/0053), so each has its own fixtures and schema version.

## Shot payload (ADR-0007; schema v3)

- **`snapshot.truncated.json`** — a hand-trimmed copy of the real raw snapshot
  `data/raw/cody-williams/2025-26/2026-07-09.json`:
  - The `LeagueAverages` frame is kept **verbatim** (all 20 fine-grain rows),
    so baseline rollups exercise the real taxonomy — including the
    `Above the Break 3` row with `Back Court(BC)` area that must sum into
    Above the Break 3, not Backcourt.
  - Shot rows: the first made and first missed shot (snapshot order) per
    evaluation zone, with Mid-Range covered per range band — 14 real rows —
    plus **one synthetic Backcourt row** (`GAME_EVENT_ID: 999`; the real hero
    took zero backcourt shots) so the exclusion path is exercised.
  - `_meta.shot_rows`, `games_included`, and `date_range` were edited to match
    the trimmed row set; `_meta.fixture_note` marks the file as a fixture.

- **`derived.golden.json`** — the derive step's output over the truncated
  snapshot. **Never edit by hand**; regenerate via `npm run golden:regen`.

## Creation payload (ADR-0030; schema v2 — Closest Defender added in v2.1)

- **`tracking.truncated.json`** — a hand-built player tracking snapshot
  (playerdashptshots shape, real headers). Deliberate traps locked in:
  - The General family **sums to 15 FGA** — reconciling against
    `derived.golden.json`'s pre-drop total (15 totalShots + 0 dropped), so the
    fixture pair itself exercises the ADR-0030 cross-payload identity.
  - The `'Other'` General row, the `'24-22'` clock band, and the
    `'0-2 Feet - Very Tight'` defender range are **absent** (the dashboards
    emit sparse rows — zero-attempt contexts are omitted; the derive must
    zero-fill).
  - Shot Clock sums to 14 → `shotClockUnattributed: 1`; Closest Defender to
    13 → `defenderUnattributed: 2` — independent coverage counters.

- **`tracking.league.truncated.json`** — a hand-built league tracking snapshot
  (leaguedashteamptshot shape, 1–2 team rows per context vs 30 real ones):
  - Filter literals differ in case from row literals (`'Pullups'`,
    `'Less Than 10 ft'`) — the resolved-filters mapping path.
  - `'Other'` is **unresolved**: its league totals are the residual by count
    subtraction (Overall 250 − resolved 240 = 10).
  - Shot Clock sums to 248 → `leagueShotClockUnattributed: 2`; Closest
    Defender to 245 → `leagueDefenderUnattributed: 5`.

- **`creation.golden.json`** — the creation derive's output over the two
  tracking fixtures. **Never edit by hand**; regenerate via
  `npm run golden:regen`.

## Shot-context payload (ADR-0032; schema v1)

- **`playbyplay.truncated.json`** — a hand-trimmed NBA Stats PlayByPlayV3 response
  containing an explicitly assisted make, an unassisted make, and a miss —
  plus the free-throw scenarios (below), which carry `isFieldGoal: 0` and are
  invisible to the shot-context parse by construction.
- **`boxscore.truncated.json`** — the matching BoxScoreTraditionalV3 response. Its per-team
  assist totals exactly reconcile with parsed scorer credits, and its player
  rows carry the hero's official free-throw line.
- **`shot-context.golden.json`** — the total one-row-per-shot derive over the
  shot golden and the one fixture game. Missing games/events stay explicit;
  they are never silently dropped or classified. **Never edit by hand**;
  regenerate via `npm run golden:regen`.

## Free-throw payload (ADR-0053; schema v1)

- Reuses the shot-context game pair above. The play-by-play fixture carries
  one scenario per golden trip class: a **missed technical** (counted, never a
  trip), a **shooting-foul trip** (1-of-2 missed — the FGA the scorer never
  recorded), an **and-one** hanging on action 480 (a made shot in the shot
  golden, exercising the exact sibling linkage), and a **bonus trip** whose
  free throws straddle an interleaved substitution (trip grouping is by
  period + clock, not adjacency).
- **`league-totals.truncated.json`** — a hand-built league season-totals
  artifact (real `LeagueDashPlayerStats` headers, 2 rows vs ~570 real ones).
  The Williams line reconciles exactly with the fixture game corpus (the
  Gate 5 oracle, ADR-0054) and its FGA matches the shot golden's pre-drop
  season FGA (15 + 0 dropped).
- **`freethrow.golden.json`** — the trip-grain derive over the shot golden,
  the fixture game pair, and the league totals fixture. **Never edit by
  hand**; regenerate via `npm run golden:regen`.

## How the handshake works

- `ingestion/test_derive_payload.py` asserts `derive(truncated) == golden`;
  `ingestion/test_derive_creation.py`, `ingestion/test_derive_shot_context.py`,
  and `ingestion/test_derive_freethrow.py` do the same for their pairs.
- `src/domain/payload.test.ts`, `src/domain/creationPayload.test.ts`,
  `src/domain/shotContextPayload.test.ts`, and
  `src/domain/freethrowPayload.test.ts` assert each golden strict-parses
  through its Zod schema (unknown keys rejected).

Any payload-shape change on either side breaks one of the suites until the
schema and the regenerated golden move together in the same PR. This depends
on the derive steps being deterministic — same inputs in, byte-identical
payload out. Bump the schema version on any breaking change (shot:
`ingestion/derive_payload.py` + `src/domain/payload.ts`; creation:
`ingestion/derive_creation.py` + `src/domain/creationPayload.ts`; context:
`ingestion/derive_shot_context.py` + `src/domain/shotContextPayload.ts`;
free throw: `ingestion/derive_freethrow.py` + `src/domain/freethrowPayload.ts`).
