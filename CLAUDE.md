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
- `python ingestion/derive_payload.py --player "Name" --season 2025-26` — derive the typed payload from the latest raw snapshot.
- `npm run hero:sync` — copy the latest derived payload to the committed `public/data/` deployment copy (ADR-0010).
- `npm run golden:regen` — regenerate `tests/fixtures/derived.golden.json`; required whenever the payload shape changes, committed in the same PR as the schema change.
- `python -m pytest ingestion -q` — Python suite (includes the ADR-0004 reconciliation tests).
- `npm test` / `npm run lint` / `npm run build` — TypeScript gate. Run all three before calling a change done.

## Testing conventions

- **Cross-language golden contract**: pytest asserts `derive(truncated snapshot) == golden`; vitest asserts the golden strict-parses through the Zod schema (`src/domain/payload.ts`). A payload-shape change must move the schema, the derive step, and the regenerated golden together. See `tests/fixtures/README.md`.
- vitest runs in **node** by default; component tests opt into jsdom per-file via a `// @vitest-environment jsdom` docblock and need an explicit `afterEach(cleanup)` (vitest globals are off, so testing-library auto-cleanup does not run).
- Under jsdom, `import.meta.url` is not a file URL — resolve fixture paths from `process.cwd()` (the repo root) in jsdom test files.
- Real-data tests use `describe.skipIf` and run only where `data/` or `public/data/` exists; they skip on clean clones by design.
