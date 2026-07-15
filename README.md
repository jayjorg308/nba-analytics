# nba-analytics

An interactive NBA shot-selection essay that answers a focused question about one player: **is he taking good shots?**

Most shot charts lead with a scatter of makes and misses and leave the interpretation to the reader. nba-analytics leads with a guarded, plain-language verdict and then shows its work: a two-axis PPS decomposition, a zone-shaded court, per-zone details, and the underlying made/missed shots. The page is structured as question → verdict → proof, not as a general-purpose stats dashboard.

**Live on Vercel:** [Cody Williams — 2025-26](https://nba-analytics-ten.vercel.app/)

The current presentation is temporarily focused on Cody Williams while his page is polished. The underlying application is player-agnostic and already supports a registry of complete hero pages at shareable URLs; the multi-player directory is intentionally dormant rather than removed.

## What the model measures

The v1 argument separates two ideas that conventional shot charts often blur:

- **Shot selection** asks what the player's chosen locations would be worth at league-average shooting. It compares his diet-weighted expected points per shot (PPS) with the expected PPS of the league's shot diet.
- **Shot making** asks what his conversion adds or subtracts after holding that diet fixed. It compares his actual PPS with the PPS expected from his locations.

Together they form an exact decomposition:

```text
league diet PPS + selection delta + making delta = actual PPS
```

The court defaults to a Zones view, where color represents the player's field-goal percentage relative to the league in each zone. Clicking a zone opens its full story: volume, FG%, PPS, diet share, league comparisons, and its place on the fixed making scale. A secondary Shots view shows every made and missed attempt with matchup context.

The product is deliberately opinionated about honesty:

- good shots are defined by expected point value, not whether they happened to go in;
- league rates are rolled up from makes and attempts, never by averaging percentages;
- small making samples are flagged, not hidden;
- backcourt shots and contradictory zone/point-value rows are excluded from evaluation and reported;
- authored verdicts are guarded by tests against the deployed data;
- displayed deltas are derived from their displayed anchors, so the visible arithmetic always reconciles.

## Data pipeline

The source is the unofficial stats.nba.com `shotchartdetail` endpoint. It blocks cloud IPs, so data collection is a local-only workflow and never runs in CI or on Vercel.

```text
stats.nba.com
  → append-only raw snapshot (gitignored)
  → validated, enriched derived payload (gitignored)
  → explicitly synced deployment copy in public/data/ (committed)
  → static Vercel deployment
```

Typical workflow:

```bash
python ingestion/pull_shots.py --player "Name"
python ingestion/derive_payload.py --player "Name" --season 2025-26
npm run hero:report -- <player-slug> 2025-26
npm run hero:sync -- <player-slug> 2025-26
```

`hero:report` prints the computed story before hero copy is written or changed. `hero:sync` is the explicit, reviewable step that copies the latest derived payload to `public/data/<player-slug>/<season>.json`. The browser fetches and Zod-validates that committed JSON; it never contacts the NBA API.

## Hosting on Vercel

The project is a static React/Vite application deployed from the repository to Vercel. There is no production backend or database: the built app and its committed JSON payloads are the complete deployment.

Vercel serves deep hero URLs through the rewrite in `vercel.json`, which sends any path to `index.html`; the app then resolves the player slug from the URL against `src/heroes/registry.ts`. Navigation uses ordinary links and full page loads, so each hero remains a self-contained, shareable argument rather than view state in a player switcher. Vercel Analytics is included in the app.

The intended multi-hero shape is one deployment containing:

- `/` — a directory of hero poster tiles;
- `/<player-slug>` — one complete question, verdict, and evidence page per player.

During the temporary single-hero period, `/` and unknown paths resolve to Cody Williams. The registry-driven directory, Keyonte George configuration and guard, payload, image, and index tests remain committed for reactivation.

## Running locally

Requires Node.js 22 and Python 3.12 (the versions used by CI).

```bash
npm install
npm run dev
```

Run the full project gates before considering a change complete:

```bash
npm test
npm run lint
npm run build
python -m pytest ingestion -q
```

The clean-clone-safe suite includes a cross-language golden contract between Python and TypeScript, real-data-aware tests that skip when local snapshots are absent, a CSS contrast/luminance guard for the court palette, per-hero verdict claim guards, display-identity checks, and zone geometry agreement checks.

## Roadmap

v1 and its close-out work are shipped: the selection/making argument, verdict-first presentation, interactive court, typed data seam, guarded hero copy, hero reporting, and registry-based multi-hero architecture are in place.

The next phase is **v2.0: creation at the bucket grain**. It starts with a tracking-splits spike, then adds a parallel typed payload for catch-and-shoot vs pull-up, shot-clock, and potentially defender-distance context. Creation will continue to use PPS and will require reconciliation and claim guards before it can extend the verdict.

After that:

- **v2.5** joins play-by-play to shots for assisted-share-of-makes and reconstructed clock context, with explicit uncertainty labels.
- **v3** adds in-progress season snapshots and freshness, rookie eligibility in live thin samples, hero scaffolding, season-over-season stories, and eventually archetype-adjusted selection benchmarks.

See [docs/ROADMAP.md](docs/ROADMAP.md) for phase details and the standing constraints.

## Technology and project docs

Built with React 19, TypeScript, Vite, Zod, Python, and hand-rolled SVG. The app is dark-only, uses self-hosted webfonts, and has no charting or client-side router dependency.

- [CONTEXT.md](CONTEXT.md) defines the project language and analytical model.
- [docs/adr/](docs/adr/) contains the 28 architectural decision records behind the product, data, presentation, and deployment choices.
- [docs/ROADMAP.md](docs/ROADMAP.md) tracks shipped phases and upcoming work.
