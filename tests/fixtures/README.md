# Cross-language golden fixtures

The committed handshake between the Python derive steps and the TypeScript
payload contracts (see ADR-0007, ADR-0030). `data/` is gitignored; these
fixtures are not. There are four independent golden contracts — the shot,
creation, shot-context, and free-throw payloads version on different clocks
(ADR-0030/0032/0053), so each has its own fixtures and schema version.

## Shot payload (ADR-0007; schema v5 — frontier metadata added by ADR-0058, usage metadata by ADR-0069)

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

- **`league-advanced.truncated.json`** — a hand-built league Advanced
  artifact (real `LeagueDashPlayerStats` Advanced headers, 2 rows vs ~580) —
  the usage-rate source (ADR-0069). The Williams row's FGA (15) matches the
  shot golden's pre-drop season FGA (the derive's FGA oracle), and its GP (7)
  deliberately exceeds the golden's `gamesIncluded` (6) by one zero-FGA
  appearance — games played may legitimately exceed the shot record (the
  spike finding that made the oracle FGA equality, never GP equality).

- **`derived.golden.json`** — the derive step's output over the truncated
  snapshot plus the advanced fixture. **Never edit by hand**; regenerate via
  `npm run golden:regen`.

## Creation payload (ADR-0030; schema v4 — Closest Defender in v2.1, trackingShortfall in v3, frontier metadata in v4)

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

## Shot-context payload (ADR-0032; schema v2 — frontier metadata added by ADR-0058)

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

## Free-throw payload (ADR-0053; schema v2 — frontier metadata added by ADR-0058)

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

## Team shot payload (ADR-0082; schema v1 — the Jazz surface's fifth contract)

- **`team-snapshot.truncated.json`** — a hand-trimmed copy of the real raw
  TEAM-WIDE snapshot `data/raw/_teams/uta/2025-26/2026-09-22.json`
  (shotchartdetail with the team ID set and player ID zero), cut to one
  game: 0022500025, UTA @ PHX, 2025-10-31 — every Jazz shot in it, 80 real
  rows across 14 shooters, plus the `LeagueAverages` frame verbatim. Two
  synthetic rows: the hero fixture's Backcourt row (`GAME_EVENT_ID: 999`,
  Cody Williams) so the hero and team fixtures describe the SAME game and
  the store test can prove hero rows load unchanged from the team pull, and
  one zone-point-conflict row (`GAME_EVENT_ID: 9999`, a 2PT scored in a
  3PT zone) so the drop-and-count path is exercised.

- **`team-roster.truncated.json`** — the real 2025-26 `commonteamroster`
  snapshot trimmed to five players: three who shot in the fixture game and
  two who did not (one with no jersey number assigned — the empty `number`
  path).

- **`team-boxscore.truncated.json`** — the real `BoxScoreTraditionalV3` for
  the fixture game with every Jazz player line in full (the ADR-0082
  per-player per-game FGA oracle) and one Suns line. The two synthetic
  shooters' FGA are raised by one each so the oracle reconciles exactly;
  `_meta.fixture_note` says so.

- **`team-shot.golden.json`** — the file derive's output over the three
  fixtures (`derive_team_payload.py`). **Never edit by hand**; regenerate via
  `npm run golden:regen`. The record-store test (`test_team_season.py`)
  loads the same fixtures through `load_team_season` + `load_game_pairs`
  and holds the export to this file byte-for-byte — one grammar
  (`team_payload.build_team_payload`), two sources.

## Game ledger facts (ADR-0084; schema v1 — the team surface's sibling contract)

- **`team-ledger.golden.json`** — the ledger derive's output over
  `team-shot.golden.json` (the game set and matchups) and
  `team-boxscore.truncated.json` (both scores and the Jazz player lines):
  one game row with the box facts and the twelve shooters, highest scorers
  first, player IDENTITY only (names live in the team payload). **Never edit
  by hand**; regenerate via `npm run golden:regen`. The store test holds
  `export_ledger_facts` to this file byte-for-byte after the team golden's
  own round trip.

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
