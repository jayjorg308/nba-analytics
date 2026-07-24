# NBA Good Shots

An interactive NBA shot-quality essay that answers focused questions about one player: **is he taking good shots, how does he create them, and what does his foul-drawing add that the shot chart cannot see?**

Most shot charts lead with a scatter of makes and misses and leave the interpretation to the reader. nba-analytics leads with a guarded, plain-language verdict and then shows its work in four acts over one reconciled season of scoring: the where (a two-axis PPS decomposition, a zone-shaded court, per-zone details), the how (league-relative creation contexts), the credit (official assisted-make evidence), and the line (free throws at trip grain, priced against the floor). The page is structured as question → verdict → proof, not as a general-purpose stats dashboard.

**Live at [nbagoodshots.com](https://www.nbagoodshots.com/):** the [hero directory](https://www.nbagoodshots.com/) at the root, with complete arguments for [Cody Williams](https://www.nbagoodshots.com/cody-williams) · [Keyonte George](https://www.nbagoodshots.com/keyonte-george) · [Shai Gilgeous-Alexander](https://www.nbagoodshots.com/shai-gilgeous-alexander) · [Ace Bailey](https://www.nbagoodshots.com/ace-bailey) (all 2025-26)

Every page's byline states its season's reconciled frontier ("through Apr 12, 2026 · 72 games"), one form for completed and living seasons, so the verdict always reads as a statement about the season through a stated date.

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

The fourth act prices the scoring the shot record excludes. Free throws are reconstructed from the same play-by-play corpus at **trip** grain: the free throws awarded from a single non-technical foul, shot as one visit to the line. Every trip carries a class recording how it arose (shooting foul, bonus, and-one, and the rarer classes), grouped into two tiers: attempt-equivalent trips that end the possession in place of a field-goal attempt, and add-on trips whose points land on top of an attempt or possession that already stands. The act compares foul generation (FTA rate, FT points share) and free-throw conversion with the league, and charts expected points per trip against the league's zone PPS values, so a drawn foul and a taken shot are weighed in the product's one value unit.

The court defaults to a Zones view, where color represents the player's field-goal percentage relative to the league in each zone. Clicking a zone opens its full story: volume, FG%, PPS, diet share, league comparisons, and its place on the fixed making scale. A secondary Shots view shows every made and missed attempt with matchup context and scorer-credit assist status for makes.

The product is deliberately opinionated about honesty:

- good shots are defined by expected point value, not whether they happened to go in;
- league rates and context rollups are built from makes and attempts, never by averaging percentages;
- small making samples are flagged, not hidden;
- backcourt shots and contradictory zone/point-value rows are excluded from evaluation and reported;
- creation claims cite shipped tracking or play-by-play evidence, never Case 1 action-type proxies;
- assisted makes require explicit official scorer credit, an exact shot/event join, and exact team box-score reconciliation;
- unknown makes never become unassisted, and unassisted never means self-created;
- hero-side trips are exact reconstructions that reconcile per game with the box score and per season with an independent league source; the 0.44 free-throw trip estimator (and any successor) is permanently forbidden;
- a shooting-foul trip keeps the denied attempt's point class (two or three free throws) but is never guessed into a zone, and technical free throws are never trips: counted and reported, excluded from evaluation;
- league free-throw comparisons include technicals on both sides because league totals cannot exclude them, and any generation or conversion claim must also survive the hero's own without-technicals cut;
- authored verdicts are guarded by tests against the deployed data;
- displayed deltas are derived from their displayed anchors, so the visible arithmetic always reconciles.

## Data pipeline

The project uses several unofficial stats.nba.com endpoints: `shotchartdetail` for shots and league zone baselines, tracking dashboards for aggregate creation contexts and league comparisons, `PlayByPlayV3` paired with `BoxScoreTraditionalV3` for per-shot assist classification and free-throw trip reconstruction, and `LeagueDashPlayerStats` season totals as both the free-throw completeness oracle (Gate 5) and the league free-throw baseline. Stats.nba.com blocks cloud IPs, so all collection is a local-only workflow and never runs in CI or on the deployed site.

```text
stats.nba.com
  → append-only shot, tracking, play-by-play, box-score, and league-totals snapshots (gitignored)
  → validated shot, creation, shot-context, and free-throw payloads (gitignored)
  → explicitly synced deployment siblings in public/data/ (committed)
  → static deployment at www.nbagoodshots.com
```

Typical completed-season workflow:

```bash
python ingestion/pull_shots.py --player "Name"
python ingestion/pull_tracking.py --players "Name"
python ingestion/pull_league_totals.py --season 2025-26
python ingestion/derive_payload.py --player "Name" --season 2025-26
python ingestion/derive_creation.py --player "Name" --season 2025-26

# Uses the registered hero's deployed shot payload to enumerate its games;
# for a hero with no deployed payload yet, pass --game-ids explicitly.
python ingestion/pull_play_by_play.py --player-slugs <player-slug> --season 2025-26
python ingestion/derive_shot_context.py \
  --shot-payload-file data/derived/<player-slug>/2025-26/<pull-date>.json
python ingestion/derive_freethrow.py \
  --shot-payload-file data/derived/<player-slug>/2025-26/<pull-date>.json

npm run hero:report -- <player-slug> 2025-26
npm run hero:sync -- <player-slug> 2025-26
```

`hero:report` prints the computed selection, making, creation-context, assisted-make, and free-throw (LINE) story, closing with a claim-headroom section that states every verdict-grade gap against the house threshold bars, before hero copy is written or changed. `hero:sync` is the explicit, reviewable step that requires and copies all four latest derived contracts to `public/data/<player-slug>/`: the shot payload, `.creation.json`, `.context.json`, and `.freethrow.json`; a partial sync fails. With no arguments it syncs every registered hero. The browser fetches and Zod-validates those committed files; it never contacts the NBA API.

For a brand-new hero, or a new season argument on an existing one, `npm run hero:scaffold -- <player-slug> <season>` generates the mechanical skeleton first: the hero config module (created, or its season list appended), the per-season verdict-guard skeleton, and the registry entry, with the player name read from the derived payload and every authored field left as a `TODO(scaffold)` placeholder. A committed authoring tripwire keeps the test suite red until all placeholders are replaced and the banner asset exists, so a half-finished hero can never merge. The tool drafts structure, never judgment: verdict prose, claim thresholds, and image crops are always written by a person.

### Living seasons

`season.config.json` designates live hero-seasons and carries the tracking-shortfall registry (characterized NBA tracking outages, pinned per game). The season loop (`npm run season:update`, scheduled daily through `scripts/season-update.ps1`) publishes only at the **reconciled frontier**: the latest game date at which every source is exactly coherent. Play-by-play availability fixes the candidate; the cumulative sources are pulled with that date as their ceiling; a tracking gap the pin registry does not explain retreats the frontier (upstream lag defers, it never fails), while a contradiction halts for a human. On green days the loop lands a data-only commit whose message carries the session report; any red morning, including a verdict guard broken by the night's games, halts the publish until a human rewrites copy and claim mapping together. A pre-flip season runs dark: derive and report daily, publish nothing, until all five eligibility gates pass and the flip ships as an authored, reviewed PR.

`python ingestion/season_replay.py` is the pre-activation proof: it drives the real loop over a calendar of historical frontier dates against a completed season and requires per-day frontier exactness, the flip signal on exactly the boundary day, and a terminal frame that reproduces the committed payloads byte-for-byte modulo provenance fields. Its first run (2026-07-23, Cody Williams 2025-26) passed every oracle.

New team marks should be normalized before being assigned to a hero:

```bash
npm run logo:normalize -- public/img/<team>-logo.png
```

The asset guard requires a transparent 1024×1024 canvas with a consistently centered visible mark, allowing one shared banner treatment across teams.

## Hosting

The project is a static React/Vite application deployed from the repository to Vercel and served at [www.nbagoodshots.com](https://www.nbagoodshots.com/). There is no production backend or database: the built app and its committed JSON payloads are the complete deployment.

Deep hero URLs are served through the rewrite in `vercel.json`, which sends any path to `index.html`; the app then resolves the player slug from the URL against `src/heroes/registry.ts`. Navigation uses ordinary links and full page loads, so each hero remains a self-contained, shareable argument rather than view state in a player switcher. Vercel Analytics is included in the app.

The multi-hero shape is one deployment containing:

- `/` - the directory of hero poster tiles, read straight off the registry;
- `/<player-slug>` - the canonical alias: the hero's current argument, rendered in place;
- `/<player-slug>/<season>` - a stable permalink for every argued season. A hero is a directory of season arguments; a live flip moves which season the alias renders and freezes the prior argument verbatim at its permalink.

Unknown paths render the directory with a quiet note. Cross-hero navigation is the tiles plus each hero page's "All players" footer link, both plain anchors; there is deliberately no player switcher.

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

The clean-clone-safe suite includes cross-language golden contracts for all four payloads, real-data-aware tests that skip when local snapshots are absent, exact tracking, assist, and free-throw trip reconciliation, four-way frontier equality across the deployed sibling payloads, the pinned tracking-shortfall guard, the season loop's decision-logic tests, deployed-payload and per-season verdict guards, the authoring tripwire (no scaffold placeholder or missing banner asset can merge), display-identity checks, court geometry checks, the committed making-palette contrast guard, the glossary punctuation guard, and the normalized team-logo asset guard.

## Roadmap

v1 through v2.6 are shipped: the selection/making argument, verdict-first presentation, interactive court, registry-based hero architecture, league-relative Case 2 creation contexts, per-shot Case 3 assisted-make analysis, and THE LINE (free throws at trip grain, with guarded per-hero line-sentences) are in place. Estimated per-shot clock was independently gated and deliberately omitted from v2.5.

**v3: living seasons** is built and its machinery is proven (2026-07-23). It added Ace Bailey as the fourth hero (whose season surfaced the first characterized hero-side tracking outages, now handled exact-or-reported with per-game pins), the reconciled-frontier contract in all four payloads' metadata, the restored hero directory, the season loop with automated data-only commits gated on the full test suite, and the replay proof: the production loop driven over seven historical frontier dates against a completed season, reproducing the committed deployment byte-for-byte modulo provenance and firing the flip signal on exactly the right day. Activation for 2026-27 is a configuration change; until opening night the loop runs dark against the unstarted season.

**Season-over-season** is built (2026-07-23): the hero-season is now the page unit, every argued season keeps a stable permalink with the hero URL as its canonical alias, and the SEASON OVER SEASON growth coda — movement in the vs-league residuals, each season measured against its own league — ships dark until Ace's flip lights the first instance. **Hero scaffolding** is built (2026-07-23): a season argument's mechanical skeleton is one command, held unmergeable by the authoring tripwire until a person writes the copy. **Archetype-adjusted selection** was explored and declined (2026-07-24, ADR-0064): a throwaway prototype showed it is a role-normalization that would soften the current roster's sharpest verdicts, so the selection axis stays benchmarked against the whole league (ADR-0002 reaffirmed). With that resolved, the planned roadmap is complete; the remaining work is operational: the 2026-27 activation and the first live flip.

See [docs/ROADMAP.md](docs/ROADMAP.md) for phase details, the activation checklist, and the standing constraints.

## Technology and project docs

Built with React 19, TypeScript, Vite, Zod, Python, and hand-rolled SVG. The app is dark-only, uses self-hosted webfonts, and has no charting or client-side router dependency.

- [CONTEXT.md](CONTEXT.md) defines the project language and analytical model.
- [docs/adr/](docs/adr/) contains the 64 architectural decision records behind the product, data, presentation, and deployment choices.
- [docs/ROADMAP.md](docs/ROADMAP.md) tracks shipped phases and upcoming work.
