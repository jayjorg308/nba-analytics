# Cross-language golden fixtures

The committed handshake between the Python derive steps and the TypeScript
payload contracts (see ADR-0007, ADR-0030). `data/` is gitignored; these
fixtures are not. There are two independent golden pairs — the shot payload
and the creation payload version on different clocks (ADR-0030), so each has
its own fixtures and its own schema version.

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

## Creation payload (ADR-0030; schema v1)

- **`tracking.truncated.json`** — a hand-built player tracking snapshot
  (playerdashptshots shape, real headers). Deliberate traps locked in:
  - The General family **sums to 15 FGA** — reconciling against
    `derived.golden.json`'s pre-drop total (15 totalShots + 0 dropped), so the
    fixture pair itself exercises the ADR-0030 cross-payload identity.
  - The `'Other'` General row and the `'24-22'` clock band are **absent**
    (the dashboards emit sparse rows — zero-attempt contexts are omitted; the
    derive must zero-fill).
  - Shot Clock sums to 14 → `shotClockUnattributed: 1` (the coverage path).

- **`tracking.league.truncated.json`** — a hand-built league tracking snapshot
  (leaguedashteamptshot shape, 1–2 team rows per context vs 30 real ones):
  - Filter literals differ in case from row literals (`'Pullups'`,
    `'Less Than 10 ft'`) — the resolved-filters mapping path.
  - `'Other'` is **unresolved**: its league totals are the residual by count
    subtraction (Overall 250 − resolved 240 = 10).
  - Shot Clock sums to 248 → `leagueShotClockUnattributed: 2`.

- **`creation.golden.json`** — the creation derive's output over the two
  tracking fixtures. **Never edit by hand**; regenerate via
  `npm run golden:regen`.

## How the handshake works

- `ingestion/test_derive_payload.py` asserts `derive(truncated) == golden`;
  `ingestion/test_derive_creation.py` does the same for the creation pair.
- `src/domain/payload.test.ts` / `src/domain/creationPayload.test.ts` assert
  each golden strict-parses through its Zod schema (unknown keys rejected).

Any payload-shape change on either side breaks one of the suites until the
schema and the regenerated golden move together in the same PR. This depends
on the derive steps being deterministic — same inputs in, byte-identical
payload out. Bump the schema version on any breaking change (shot:
`ingestion/derive_payload.py` + `src/domain/payload.ts`; creation:
`ingestion/derive_creation.py` + `src/domain/creationPayload.ts`).
