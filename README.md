# nba-analytics

An interactive NBA shot-selection and shot-creation essay that answers two focused questions about one player: **is he taking good shots, and how does he create them?**

Most shot charts lead with a scatter of makes and misses and leave the interpretation to the reader. nba-analytics leads with a guarded, plain-language verdict and then shows its work: a two-axis PPS decomposition, a zone-shaded court, per-zone details, league-relative creation contexts, official assisted-make evidence, and the underlying shots. The page is structured as question → verdict → proof, not as a general-purpose stats dashboard.

**Live on Vercel:** [Cody Williams — 2025-26](https://nba-analytics-ten.vercel.app/) · [Keyonte George — 2025-26](https://nba-analytics-ten.vercel.app/keyonte-george) · [Shai Gilgeous-Alexander — 2025-26](https://nba-analytics-ten.vercel.app/shai-gilgeous-alexander)

The current root presentation remains temporarily focused on Cody Williams while his page is polished. The player-agnostic application registers complete Cody, Keyonte, and Shai hero pages at shareable URLs; only the multi-player directory is intentionally dormant.

## What the model measures

The primary argument separates two ideas that conventional shot charts often blur:

- **Shot selection** asks what the player's chosen locations would be worth at league-average shooting. It compares his diet-weighted expected points per shot (PPS) with the expected PPS of the league's shot diet.
- **Shot making** asks what his conversion adds or subtracts after holding that diet fixed. It compares his actual PPS with the PPS expected from his locations.

Together they form an exact decomposition:

```text
league diet PPS + selection delta + making delta = actual PPS
```

The second act asks how those shots were created through two independent sources:

- **Case 2 tracking contexts** compare the player's PPS and attempt share with the league across how the shot arrived, shot-clock bands, and closest-defender bands. These are aggregate NBA tracking categories, never labels inferred for individual shots.
- **Case 3 shot context** joins official play-by-play to exact shot identities and classifies made shots as assisted, unassisted, or unknown. The product reports assisted share by shooting area without inventing a league baseline. Unknown makes widen conservative coverage bounds; complete coverage suppresses the redundant Unknown, Coverage, and Bounds table columns.

The court defaults to a Zones view, where color represents the player's field-goal percentage relative to the league in each zone. Clicking a zone opens its full story: volume, FG%, PPS, diet share, league comparisons, and its place on the fixed making scale. A secondary Shots view shows every made and missed attempt with matchup context and scorer-credit assist status for makes.

The product is deliberately opinionated about honesty:

- good shots are defined by expected point value, not whether they happened to go in;
- league rates and context rollups are built from makes and attempts, never by averaging percentages;
- small making samples are flagged, not hidden;
- backcourt shots and contradictory zone/point-value rows are excluded from evaluation and reported;
- creation claims cite shipped tracking or play-by-play evidence, never Case 1 action-type proxies;
- assisted makes require explicit official scorer credit, an exact shot/event join, and exact team box-score reconciliation;
- unknown makes never become unassisted, and unassisted never means self-created;
- authored verdicts are guarded by tests against the deployed data;
- displayed deltas are derived from their displayed anchors, so the visible arithmetic always reconciles.

## Data pipeline

The project uses several unofficial stats.nba.com endpoints: `shotchartdetail` for shots and league zone baselines, tracking dashboards for aggregate creation contexts and league comparisons, and `PlayByPlayV3` paired with `BoxScoreTraditionalV3` for per-shot assist classification. Stats.nba.com blocks cloud IPs, so all collection is a local-only workflow and never runs in CI or on Vercel.

```text
stats.nba.com
  → append-only shot, tracking, play-by-play, and box-score snapshots (gitignored)
  → validated shot, creation, and shot-context payloads (gitignored)
  → explicitly synced deployment siblings in public/data/ (committed)
  → static Vercel deployment
```

Typical completed-season workflow:

```bash
python ingestion/pull_shots.py --player "Name"
python ingestion/pull_tracking.py --players "Name"
python ingestion/derive_payload.py --player "Name" --season 2025-26
python ingestion/derive_creation.py --player "Name" --season 2025-26

# Uses the registered hero's deployed shot payload to enumerate its games.
python ingestion/pull_play_by_play.py --player-slugs <player-slug> --season 2025-26
python ingestion/derive_shot_context.py \
  --shot-payload-file data/derived/<player-slug>/2025-26/<pull-date>.json

npm run hero:report -- <player-slug> 2025-26
npm run hero:sync -- <player-slug> 2025-26
```

`hero:report` prints the computed selection, making, creation-context, and assisted-make story before hero copy is written or changed. `hero:sync` is the explicit, reviewable step that requires and copies all three latest derived contracts to `public/data/<player-slug>/`: the shot payload, `.creation.json`, and `.context.json`. With no arguments it syncs every registered hero. The browser fetches and Zod-validates those committed files; it never contacts the NBA API.

New team marks should be normalized before being assigned to a hero:

```bash
npm run logo:normalize -- public/img/<team>-logo.png
```

The asset guard requires a transparent 1024×1024 canvas with a consistently centered visible mark, allowing one shared banner treatment across teams.

## Hosting on Vercel

The project is a static React/Vite application deployed from the repository to Vercel. There is no production backend or database: the built app and its committed JSON payloads are the complete deployment.

Vercel serves deep hero URLs through the rewrite in `vercel.json`, which sends any path to `index.html`; the app then resolves the player slug from the URL against `src/heroes/registry.ts`. Navigation uses ordinary links and full page loads, so each hero remains a self-contained, shareable argument rather than view state in a player switcher. Vercel Analytics is included in the app.

The intended multi-hero shape is one deployment containing:

- `/` — eventually, a directory of hero poster tiles;
- `/<player-slug>` — one complete question, verdict, and evidence page per player.

During the temporary directory-less period, `/` and unknown paths resolve to Cody Williams. Keyonte George and Shai Gilgeous-Alexander remain live at their direct URLs, and the registry-driven directory stays committed for reactivation.

## Running locally

Requires Node.js 22 and Python 3.12 (the versions used by CI).

```bash
npm install
pip install -r ingestion/requirements.txt
npm run dev
```

Run the full project gates before considering a change complete:

```bash
npm test
npm run lint
npm run build
python -m pytest ingestion -q
```

The clean-clone-safe suite includes cross-language golden contracts for all three payloads, real-data-aware tests that skip when local snapshots are absent, exact tracking and assist reconciliation, deployed-payload and per-hero verdict guards, display-identity checks, court geometry checks, the committed making-palette contrast guard, and the normalized team-logo asset guard.

## Roadmap

v1 through v2.5 are shipped: the selection/making argument, verdict-first presentation, interactive court, registry-based hero architecture, league-relative Case 2 creation contexts, and per-shot Case 3 assisted-make analysis are in place for Cody Williams, Keyonte George, and Shai Gilgeous-Alexander. Estimated per-shot clock was independently gated and deliberately omitted from v2.5 because the completed-season Stats V3 source could not support the required reconstruction audit.

The next phase is **v3: living seasons and heroes at scale**:

- in-progress season snapshots, refresh cadence, and visible data freshness;
- a rookie hero that exercises eligibility gates on a live thin sample;
- hero scaffolding generated from `hero:report` output;
- season-over-season stories;
- eventually, archetype-adjusted selection benchmarks.

See [docs/ROADMAP.md](docs/ROADMAP.md) for phase details and the standing constraints.

## Technology and project docs

Built with React 19, TypeScript, Vite, Zod, Python, and hand-rolled SVG. The app is dark-only, uses self-hosted webfonts, and has no charting or client-side router dependency.

- [CONTEXT.md](CONTEXT.md) defines the project language and analytical model.
- [docs/adr/](docs/adr/) contains the 50 architectural decision records behind the product, data, presentation, and deployment choices.
- [docs/ROADMAP.md](docs/ROADMAP.md) tracks shipped phases and upcoming work.
