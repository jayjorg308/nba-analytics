# NBA Good Shots

Good Shots is a Utah Jazz site. Its front page is the Jazz's current season: the latest game and the three before it, the players the season is about, and the season's shot evidence, with a report card for each published game, a night for every Jazz player who appeared in it, and a season page for every player with a shot for the team. Beside the team sit interactive NBA shot-quality essays, complete arguments that each answer focused questions about one player's season: **is he taking good shots, how does he create them, and what does his foul-drawing add that the shot chart cannot see?**

Most shot charts lead with a scatter of makes and misses and leave the interpretation to the reader. An argument leads with a guarded, plain-language verdict and then shows its work in four acts over one reconciled season of scoring: the where (a two-axis PPS decomposition, a zone-shaded court, per-zone details), the how (league-relative creation contexts), the credit (official assisted-make evidence), and the line (free throws at trip grain, priced against the floor). The page is structured as question → verdict → proof, not as a general-purpose stats dashboard.

**Live at [nbagoodshots.com](https://www.nbagoodshots.com/):** the [Utah Jazz's 2026-27 season](https://www.nbagoodshots.com/) at the root, and the [directory of arguments](https://www.nbagoodshots.com/arguments) with complete arguments for [Cody Williams](https://www.nbagoodshots.com/cody-williams) · [Keyonte George](https://www.nbagoodshots.com/keyonte-george) · [Shai Gilgeous-Alexander](https://www.nbagoodshots.com/shai-gilgeous-alexander) · [Ace Bailey](https://www.nbagoodshots.com/ace-bailey) · [Donovan Mitchell](https://www.nbagoodshots.com/donovan-mitchell) · [Nique Clifford](https://www.nbagoodshots.com/nique-clifford) · [Maxime Raynaud](https://www.nbagoodshots.com/maxime-raynaud) · [Bub Carrington](https://www.nbagoodshots.com/bub-carrington) · [Alex Sarr](https://www.nbagoodshots.com/alex-sarr) · [Austin Reaves](https://www.nbagoodshots.com/austin-reaves) · [Jalen Brunson](https://www.nbagoodshots.com/jalen-brunson) (all 2025-26), and [the methodology](https://www.nbagoodshots.com/methodology) behind them

Every argument's byline carries the hero's official usage rate as descriptive role context ("15.9% usage", the NBA's own figure, presented and never computed) and its season's reconciled frontier ("through Apr 12, 2026 · 72 games"), one form for completed and living seasons, so the verdict always reads as a statement about the season through a stated date.

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
- usage rate is presented, never computed: conventional usage math embeds the forbidden 0.44 estimator, so the page shows the NBA's official figure as descriptive context only, pinned to the payload's own record by an exact FGA reconciliation, fenced out of evaluation, and reserved out of verdict vocabulary;
- authored verdicts are guarded by tests against the deployed data, and their grading words ("well above", "far below") price on one shared house ladder so the same word promises the same magnitude on every page;
- displayed deltas are derived from their displayed anchors, so the visible arithmetic always reconciles.

## Data pipeline

The project uses several unofficial stats.nba.com endpoints: `shotchartdetail` for shots and league zone baselines, tracking dashboards for aggregate creation contexts and league comparisons, `PlayByPlayV3` paired with `BoxScoreTraditionalV3` for per-shot assist classification and free-throw trip reconstruction, and `LeagueDashPlayerStats` season totals as both the free-throw completeness oracle (Gate 5) and the league free-throw baseline, with its Advanced measure supplying each hero's official usage rate. Stats.nba.com blocks cloud IPs, so all collection is a local-only workflow and never runs in CI or on the deployed site.

```text
stats.nba.com
  → append-only shot, tracking, play-by-play, box-score, and league totals/advanced snapshots (gitignored)
  → the record store: Postgres (Neon) holding observations at natural NBA identity (ADR-0080)
  → exported shot, creation, shot-context, and free-throw payloads (gitignored)
  → explicitly synced deployment siblings in public/data/ (committed)
  → static deployment at www.nbagoodshots.com
```

Since the 2026-08-24 cutover (ADR-0080), the middle of that pipeline is a relational record store: loaders upsert each snapshot's observations with classified change detection (cumulative growth flows; corrections, deletions, and contradictions halt for a human), derived tables (free-throw trips, shot context) rebuild through the unmodified derive grammars, and the four payload exports were proven byte-identical against the committed corpus for every registered hero before the store became the production path. The raw snapshot files remain the append-only rebuild source, and the file derives remain for golden regeneration and as an explicit fallback engine.

Adding a completed-season hero is one resumable command that runs the whole recipe (the raw pulls, the four derives, completing the shared play-by-play corpus with only the games it is missing, the config scaffold, the headshot and share-card assets, the deploy sync, and the closing authoring report):

```bash
npm run hero:add -- "Player Name" 2025-26
```

Every step remains an explicit command underneath (the `ingestion/pull_*.py` and `ingestion/derive_*.py` scripts, `hero:scaffold`, `cards:generate`, `hero:sync`, `hero:report`) for partial reruns and the living-season tooling; a failed add is rerun with the same command and continues where it left off.

`hero:report` prints the computed selection, making, creation-context, assisted-make, and free-throw (LINE) story, closing with a claim-headroom section that states every verdict-grade gap against the house threshold bars, before hero copy is written or changed. `hero:sync` is the explicit, reviewable step that requires and copies all four latest derived contracts to `public/data/<player-slug>/`: the shot payload, `.creation.json`, `.context.json`, and `.freethrow.json`; a partial sync fails. With no arguments it syncs every registered hero. The browser fetches and Zod-validates those committed files; it never contacts the NBA API.

For a brand-new hero, or a new season argument on an existing one, `npm run hero:scaffold -- <player-slug> <season>` (run automatically inside `hero:add`) generates the mechanical skeleton first: the hero config module (created, or its season list appended), the per-season verdict-guard skeleton, and the registry entry, with the player name read from the derived payload and every authored field left as a `TODO(scaffold)` placeholder. A committed authoring tripwire keeps the test suite red until all placeholders are replaced and both image assets exist (the banner photo and the directory's headshot), so a half-finished hero can never merge. The tool drafts structure, never judgment: verdict prose, claim thresholds, and image crops are always written by a person.

### Living seasons

`season.config.json` designates live hero-seasons and carries the tracking-shortfall registry (characterized NBA tracking outages, pinned per game). The season loop (`npm run season:update`) publishes only at the **reconciled frontier**: the latest game date at which every source is exactly coherent. Play-by-play availability fixes the candidate; the cumulative sources are pulled with that date as their ceiling; a tracking gap the pin registry does not explain retreats the frontier (upstream lag defers, it never fails), while a contradiction halts for a human. On green days the loop lands a data-only commit whose message carries the session report; any red morning, including a verdict guard broken by the night's games, halts the publish until a human rewrites copy and claim mapping together. A pre-flip season runs dark: derive and report daily, publish nothing, until all five eligibility gates pass and the flip ships as an authored, reviewed PR.

The loop runs from its own clone of the repository, kept on `main`, so the branch checked out for development never decides what publishes. Two scheduled tasks drive it through `scripts/season-update.ps1`: every live session at 06:30, and the Jazz team session again at 23:45, so from opening night a game can publish the night it ends. The wrapper pulls `main` before each run, and the loop refuses to write to the production record store or make a data commit from any other branch. After every session, halted or not, the raw layer is copied to a private Cloudflare R2 bucket, copy-only and immutable, so the append-only rule holds off the machine too (ADR-0006, as amended). `season.config.json` lists the live team seasons beside the hero seasons.

`python ingestion/season_replay.py` is the pre-activation proof: it drives the real loop over a calendar of historical frontier dates against a completed season and requires per-day frontier exactness, the flip signal on exactly the boundary day, and a terminal frame that reproduces the committed payloads byte-for-byte modulo provenance fields. Its first run (2026-07-23, Cody Williams 2025-26) passed every oracle on the file derives; its second (2026-08-24, same subject) passed every oracle on the record-store engine against a throwaway Dockerized Postgres, living the store's whole lifecycle from empty. That run was the gate that authorized the cutover.

New team marks should be normalized before being assigned to a hero:

```bash
npm run logo:normalize -- public/img/<team>-logo.png
```

The asset guard requires a transparent 1024×1024 canvas with a consistently centered visible mark, allowing one shared banner treatment across teams.

## Hosting

The project is a static React/Vite application deployed from the repository to Vercel and served at [www.nbagoodshots.com](https://www.nbagoodshots.com/). There is no runtime backend: the built app and its committed JSON payloads are the complete deployment, and the browser never contacts a server-side API or database. The record store (ADR-0080) sits entirely behind the export pipeline on the ingestion side, and the deployed site neither knows nor needs it.

Deep hero URLs are served through the rewrite in `vercel.json`, which sends any path to `index.html`; the app then resolves the player slug from the URL against `src/heroes/registry.ts`. Navigation uses ordinary links and full page loads, so each hero remains a self-contained, shareable argument rather than view state in a player switcher. Vercel Analytics is included in the app.

Shared links preview their player: the build's final step emits a real file at every hero route (the canonical alias and each season permalink). Each is a copy of the built page whose title, description, `og:`/`twitter:` card, and per-page `og:url` name that player over his generated 1200×630 share card (`public/social-cards/`, rendered by `npm run cards:generate` from the committed headshot, wordmark, and pinned fonts). Static files are served before the rewrite applies, so scrapers read hero meta while the app boots identically. The root, `/jazz`, and `/jazz/2025-26` preview a static season card (the team mark beside the wordmark, one per season, drawn by the same command), and every player season page names its player in its title, description, and `og:url` over his season's card, so a new shooter needs no new art. Every report card previews its own game card (the score, the two answers, and the game's court, drawn by `npm run cards:games` from committed files, which the season loop runs for each new game), and every player's night names him over that game's card. `/arguments` keeps the product-wide wordmark card. The root's page carries no `og:url`, because the host also serves it for every route without a page of its own. The emitted pages also preload their exact payload fetch set and the above-the-fold webfonts, and `vercel.json` serves hashed assets immutable and data payloads stale-while-revalidate, so repeat visits render without a loading beat.

The multi-hero shape is one deployment containing:

- `/` - the Jazz home: the canonical team season, rendered at the root (described under `/jazz` below);
- `/arguments` - the directory: a headshot marquee over a name-only rail of every argument, the Jazz arguments first, read straight off the registry, with one line of self-explanation between them;
- `/<player-slug>` - the canonical alias: the hero's current argument, rendered in place;
- `/<player-slug>/<season>` - a stable permalink for every argued season. A hero is a directory of season arguments; a live flip moves which season the alias renders and freezes the prior argument verbatim at its permalink;
- `/methodology` - the one static page: how the numbers are made and read, in structural copy with no per-hero claims, closing with the imagery credits. Its vocabulary section re-renders the same glossary registry the in-page dictionary popovers read, so the two can never disagree;
- `/compare` - the comparison tool, deliberately a tool and not an argument: two registered players' shot profiles side by side in one shared season, or one player before and since a split date, over exact windows and one shared league baseline, with the zone evidence as per-zone priced calls and, in a player comparison, the free-throw line under the same call grammar. No verdict and no winner; the whole comparison is owned by its URL, so every result is shareable and reproducible.
- `/jazz` - the same home at its alias, also a tool with no verdict: the season banner, the latest game's report card in brief with the three games before it, the season's featured players (Keyonte George, Ace Bailey, and Darryn Peterson in 2026-27) as headshot cards over a rail of every other shooter, then the season's quadrant, the team's season shot profile against the league zone by zone, a game ledger, and the arguments. Each game links its report card at `/jazz/<date>-<opponent>` (for example `/jazz/2026-10-23-nop`). A report card places the game on the season's quadrant, answers whether the shots were good and whether they fell, sets both teams on the same terms, and lists each player's line, with every game priced against the league as it stood entering that day. Each name opens that player's night at `/jazz/<date>-<opponent>/<player-slug>`: his two answers on the same terms, his free-throw line and assisted makes as counts, his shot chart, and a receipt of every attempt and trip in game order down to his box points. Every player with a shot that season has a season page at `/jazz/<player-slug>` (or `/jazz/<season>/<player-slug>` for an earlier season): his games on the same quadrant, his season zone by zone, and his game log, each game opening his night, linked from every night and, for a Jazz argument, from the argument itself. It opens on the 2026-27 season, with a report card for each published game, and keeps the completed 2025-26 season at `/jazz/2025-26` in the same layout.

Unknown paths render the directory with a quiet note. Navigation is plain anchors: the directory's player links, the "Good Shots" wordmark in the site navbar (the way home, to the Jazz season), and the footer's Arguments link on every page but the directory itself; there is deliberately no player switcher, and the navbar carries no hero list or menu. The shared footer sits in three registered zones (utility links left, the tagline centered, outward social links right), where a utility standing alone in its zone spells itself out and utilities in company compress to icons.

## Running locally

Requires Node.js 22 and Python 3.12 (the versions used by CI). Docker is needed only for the record-store tests and the replay proof (they run against a throwaway Postgres container and skip loudly without it); ingestion against the production store reads its DSN from a gitignored `.env` (`.env.example` documents the shape).

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

The clean-clone-safe suite includes cross-language golden contracts for all seven payload contracts, real-data-aware tests that skip when local snapshots are absent, exact tracking, assist, and free-throw trip reconciliation, four-way frontier equality across the deployed sibling payloads, the pinned tracking-shortfall guard, the usage-rate unit guard and FGA oracle, the season loop's decision-logic and branch-guard tests, deployed-payload and per-season verdict guards, the authoring tripwire (no scaffold placeholder or missing image asset can merge), the share-card guard (a committed 1200×630 card per registered hero, with the share-meta transform tested against the real `index.html`), display-identity checks, court geometry checks, the committed making-palette contrast guard, the glossary and hero-copy punctuation guards, the methodology page's own suite (every glossary entry rendered, every registered banner credited, no em dash anywhere on the page), the reserved-route guard that stops a hero slug from shadowing a static page, and the normalized team-logo asset guard.

## Roadmap

v1 through v2.6 are shipped: the selection/making argument, verdict-first presentation, interactive court, registry-based hero architecture, league-relative Case 2 creation contexts, per-shot Case 3 assisted-make analysis, and THE LINE (free throws at trip grain, with guarded per-hero line-sentences) are in place. Estimated per-shot clock was independently gated and deliberately omitted from v2.5.

**v3: living seasons** is built and its machinery is proven (2026-07-23). It added Ace Bailey as the fourth hero (whose season surfaced the first characterized hero-side tracking outages, now handled exact-or-reported with per-game pins), the reconciled-frontier contract in all four payloads' metadata, the restored hero directory, the season loop with automated data-only commits gated on the full test suite, and the replay proof: the production loop driven over seven historical frontier dates against a completed season, reproducing the committed deployment byte-for-byte modulo provenance and firing the flip signal on exactly the right day. Activation for 2026-27 is a configuration change; until opening night the loop runs dark against the unstarted season.

**Season-over-season** is built (2026-07-23): the hero-season is now the page unit, every argued season keeps a stable permalink with the hero URL as its canonical alias, and the SEASON OVER SEASON growth coda (movement in the vs-league residuals, each season measured against its own league) ships dark until Ace's flip lights the first instance. **Hero scaffolding** is built (2026-07-23): a season argument's mechanical skeleton is one command, held unmergeable by the authoring tripwire until a person writes the copy. **Archetype-adjusted selection** was explored and declined (2026-07-24, ADR-0064): a throwaway prototype showed it is a role-normalization that would soften the current roster's sharpest verdicts, so the selection axis stays benchmarked against the whole league (ADR-0002 reaffirmed). With that resolved, the planned roadmap is complete; the remaining work is operational: the 2026-27 activation and the first live flip.

**Launch tooling** (2026-07-27): the standing add recipe became the one resumable `hero:add` command (ADR-0066), proven the same day by adding Donovan Mitchell as the fifth hero, and shared hero links gained per-hero social cards through build-time-emitted share pages (ADR-0067).

**Launch polish** (2026-07-28): the pre-launch round closed in one day. It delivered a shared site footer on both page types; a verdict consistency pass across all five heroes that grew into the house ladder (ADR-0068: grading words price on one shared scale, consumed by every guard); payload and asset caching with payload and critical-font preloads on the emitted pages; directory team marks considered and declined for restraint (ADR-0065); and usage rate as sourced descriptive context (ADR-0069: the official `USG_PCT` on every byline, presented never computed, verified through an exact FGA reconciliation, its vocabulary reserved out of verdicts).

**Verdict voice** (2026-07-29, ADR-0070): authored copy is now written from a committed voice guide distilled from red-penned before/after samples, which outrank the guide where they disagree. Voice operates strictly inside the house rails: a voice edit never re-grades a magnitude word, and one that adds a fact adds a guarded claim. The Kings adds, Nique Clifford and Maxime Raynaud, were the guide's first live use and brought the roster to seven.

**Launch complete** (2026-07-30, ADR-0071): the last two launch items closed together. The methodology page ships as the site's one self-explanation surface, and the directory gains a single line of self-explanation linking it, so a cold visitor learns what the site is without the marquee gaining a deck. The same change made image credits reader-facing: every banner is credited on that page, with an unknown credit stated plainly rather than omitted. The planned roadmap is now complete; what remains is operational, the 2026-27 activation and the first live flip.

**Comparison page** (2026-08-12 → 2026-08-23, ADRs 0073–0079): the first post-launch surface. `/compare` renders two shot profiles side by side (two registered players in one shared season, or one player before and since a split date) over exact comparison windows, one shared league baseline, and URL-owned state. The zone evidence ships as a scoreboard of priced calls (ADR-0078, prototype-chosen from four variants), and player comparisons carry the free-throw line in the same grammar (ADR-0079): season-line cards with Draw edge, Conversion edge, and Reliance lean calls over the transposed trip taxonomy. Free throws needed no data change in players mode (a full-season window is exactly the season-total contract), while the before-and-since mode defers them until a date-grained free-throw contract exists.

**Database migration** (2026-08-24, ADR-0080): the storage story gained a relational middle in one day-long push, grilled decision-by-decision beforehand. A Neon-hosted Postgres record store now holds every observation at natural NBA identity (shots, all-player play-by-play events, box lines, tracking splits, league oracles), product-blind and rebuildable from the raw layer, with derived trips and shot context rebuilt through the unmodified derive grammars. The migration was held to a byte-identical parity oracle (all four contracts, all registered heroes) and closed with the season loop cut over to the record-store engine after a second replay proof passed every oracle on it. The committed payloads and the static site are unchanged by design; the migration also flushed real defects the oracle caught (collapsed duplicate play-by-play events, absolute local paths shipped in deployed payload provenance) and unlocked the date-grained free-throw contract the comparison page's split mode is waiting on.

**Jazz-first direction** (2026-09-24 → 2026-09-25): the next season belongs to one team. The [Jazz-first site plan](docs/plans/jazz-first-site.md) turns Good Shots into a Utah Jazz site for 2026-27, with a shareable report card after every game and living arguments for Keyonte George, Ace Bailey, and Darryn Peterson, while every other argument stays frozen at its permalink. Its first phase merged two prototype lines, the team page and game cards, into one history, and hardened the season loop for a live team: its own clone, a pull before every run, a branch guard on production writes and data commits, a game-night window, and an off-machine copy of the raw layer. Setting up the clone also caught a path bug that would have written absolute local paths into the record store's snapshot catalog and every payload's provenance, the same class of defect the migration had caught once already.

**The Jazz home** (2026-10-28 → 2026-10-29, ADRs 0087, 0094, 0095): the 2026-27 season went live through the season loop, which publishes each new game's report card in its nightly sessions. The report card gained the poster banner and numbered acts, every Jazz shooter gained a season page, and the site root became the Jazz home, chosen from a two-variant prototype, with the directory of arguments moved to `/arguments` and every argument URL unchanged.

**The player's night** (2026-10-30 → 2026-10-31, ADR-0096): every Jazz appearance gained a page of its own, one player's game read from the same game file as its report card and priced against the same day's league, so its numbers are his dot on his season page. The layout was chosen from a two-variant prototype; the earlier game cards, which it replaces, retire next.

See [docs/ROADMAP.md](docs/ROADMAP.md) for phase details, the activation checklist, and the standing constraints.

## Technology and project docs

Built with React 19, TypeScript, Vite, Zod, Python, and hand-rolled SVG. The app is dark-only, uses self-hosted webfonts, and has no charting or client-side router dependency.

- [CONTEXT.md](CONTEXT.md) defines the project language and analytical model.
- [docs/adr/](docs/adr/) contains the 93 architectural decision records behind the product, data, presentation, and deployment choices.
- [docs/ROADMAP.md](docs/ROADMAP.md) tracks shipped phases and upcoming work.

## License

Copyright © 2026 Jayson Jorgensen. All rights reserved.

This repository is public so the method can be read and the arguments checked. It is not open source: no permission is granted to copy, modify, or redistribute the code, the derived payloads, or the authored analysis. If you want to build on it, ask.

Player photographs, headshots, and team marks are the property of their respective owners and appear here for non-commercial illustrative purposes. Each is credited on the [methodology page](https://www.nbagoodshots.com/methodology), with the engineering provenance recorded in [docs/image-credits.md](docs/image-credits.md).
