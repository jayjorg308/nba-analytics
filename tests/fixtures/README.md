# Cross-language golden fixtures

The committed handshake between the Python derive step and the TypeScript
payload contract (see ADR-0007). `data/` is gitignored; these fixtures are not.

## Files

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
  snapshot. **Never edit by hand**; regenerate from the repo root:

  ```
  python ingestion/derive_payload.py --snapshot-file tests/fixtures/snapshot.truncated.json --out-file tests/fixtures/derived.golden.json
  ```

  (also available as `npm run golden:regen`)

## How the handshake works

- `ingestion/test_derive_payload.py` asserts `derive(truncated) == golden`.
- `src/domain/payload.test.ts` asserts the golden strict-parses through the
  Zod schema (unknown keys rejected).

Any payload-shape change on either side breaks one of the two suites until the
schema and the regenerated golden move together in the same PR. This depends on
the derive step being deterministic — same snapshot in, byte-identical payload
out. Bump `schemaVersion` (both `ingestion/derive_payload.py` and
`src/domain/payload.ts`) on any breaking change.
