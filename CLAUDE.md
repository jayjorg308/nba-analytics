# nba-analytics

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues via the `gh` CLI; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (one `CONTEXT.md` + `docs/adr/` at the repo root). See `docs/agents/domain.md`.

## Commands

- `python ingestion/pull_shots.py --player "Name"` — pull raw snapshots. **Local only**: stats.nba.com blocks cloud IPs; never run from CI or the deployed app.
- `python ingestion/pull_tracking.py` — pull tracking-splits snapshots (both heroes + the league baseline by default) and print the spike report. Same local-only constraint.
- `python ingestion/derive_payload.py --player "Name" --season 2025-26` — derive the typed payload from the latest raw snapshot.
- `python ingestion/derive_creation.py --player "Name"` — derive the creation payload (ADR-0030) from the latest tracking snapshots; hard-fails unless the General family reconciles exactly with the sibling shot payload.
- `python ingestion/derive_freethrow.py --shot-payload-file public/data/<slug>/<season>.json` — derive the free-throw payload (ADR-0053) from the shared play-by-play corpus plus the league season-totals artifact; hard-fails unless every trip classifies, every game matches the box-score free-throw line, and the season reconciles exactly with the league artifact (Gate 5, ADR-0054).
- `npm run hero:sync` — copy the latest derived payloads (shot + creation — both required per hero, ADR-0030) to the committed `public/data/` deployment copy (ADR-0010). No args = every hero in the registry (`src/heroes/registry.ts`); `-- <slug> <season>` syncs one, registered or not.
- `npm run hero:report -- <player-slug> <season>` — print the hero's computed story (gates, ADR-0016 decomposition, per-zone bins/flags, the ADR-0030 creation section, the ADR-0032 assisted-makes section, and the ADR-0053 LINE section: season free-throw line with both cuts + the trip taxonomy) from the latest derived payloads; `--deployed` reads the committed copies, `--file <path>` (+ optional `--creation-file` / `--context-file` / `--freethrow-file <path>`) any payloads. Every hero swap — and every why-sentence (ADR-0029) — starts by reading this.
- `npm run golden:regen` — regenerate all four goldens (shot, creation, shot-context, freethrow — `tests/fixtures/*.golden.json`); required whenever any payload shape changes, committed in the same PR as the schema change.
- `python -m pytest ingestion -q` — Python suite (includes the ADR-0004 rollup reconciliation and the ADR-0030 cross-payload reconciliation tests).
- `npm test` / `npm run lint` / `npm run build` — TypeScript gate. Run all three before calling a change done.

## Testing conventions

- **Cross-language golden contract**: pytest asserts `derive(truncated snapshot) == golden`; vitest asserts the golden strict-parses through the Zod schema. Four independent golden pairs — shot (`src/domain/payload.ts`), creation (`src/domain/creationPayload.ts`, ADR-0030), shot-context (`src/domain/shotContextPayload.ts`, ADR-0032), and free throw (`src/domain/freethrowPayload.ts`, ADR-0053) — each versioned on its own clock. A payload-shape change must move the schema, the derive step, and the regenerated golden together. See `tests/fixtures/README.md`.
- **Committed reconciliation guard (ADR-0030)**: `src/domain/creationPayload.real.test.ts` asserts every registered hero has a deployed creation payload and every deployed creation payload agrees with its sibling shot payload on the pre-drop season FGA (`seasonFga == totalShots + zoneConflictsDropped`) — a one-sided `hero:sync` fails the suite. The same identity hard-fails `derive_creation.py` at derive time.
- vitest runs in **node** by default; component tests opt into jsdom per-file via a `// @vitest-environment jsdom` docblock and need an explicit `afterEach(cleanup)` (vitest globals are off, so testing-library auto-cleanup does not run).
- Under jsdom, `import.meta.url` is not a file URL — resolve fixture paths from `process.cwd()` (the repo root) in jsdom test files.
- Real-data tests use `describe.skipIf` and run only where `data/` or `public/data/` exists; they skip on clean clones by design.
- **Committed design guard**: `src/chart/makingScale.contrast.test.ts` parses the actual CSS (`src/App.css` / `src/index.css`) and enforces the making-scale palette invariants (label contrast, per-arm monotone luminance, gray neutral) for the dark theme — the only theme the app ships (ADR-0024). Tune `--making-*` hexes freely — the guard defines validity; never weaken its assertions to admit a palette (ADR-0014).
- **Committed verdict guards**: each hero's `src/heroes/<slug>.guard.test.ts` (colocated with its config module, ADR-0022) asserts every directional claim in that hero's verdict against its deployed payloads' metrics — shot AND creation (ADR-0017/0029). Creation vocabulary in a verdict requires ≥1 declared creation-kind claim (shared lexicon + tripwire: `src/heroes/verdictLexicon.ts`); assisted/contested vocabulary stays forbidden until its data ships. If a `hero:sync` or hero swap breaks a claim, rewrite the copy and the guard's claim mapping together — never loosen an assertion.
- **Committed display-identity guard**: `src/app/HeadlineBanner.identity.test.tsx` asserts the headline pair's displayed numbers subtract exactly, for the golden and every registered hero's deployed payload. Deltas shown beside their anchors are anchor gaps (`formatSignedGap`), never the rounded raw delta (ADR-0023).
