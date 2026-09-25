# Jazz Surface Plan

> **Superseded in part (2026-09-24)** by `docs/plans/jazz-first-site.md`,
> which widens this surface into a Jazz-first site and wins wherever the
> two disagree. Its migration `0007_team_shots.sql` is now
> `0009_team_surface.sql`.

_Drafted 2026-09-22 from a design conversation (placement, MVP content, voice,
and roster scope decided; see "Decisions already made"). The plan follows the
comparison-page precedent: a tool surface beside the hero arguments, built in
vertical increments that each leave the suite green. The decisions it proposes
for ADRs are listed under "Decisions to record" and are not yet written._

> **Amendment (2026-09-22, increments 1 and 2).** Two departures from the
> text below, both recorded in the ADRs. The team shot payload's FGA oracle
> reconciles against the per-player box-score lines, per game, rather than a
> league team-totals artifact (ADR-0082): stronger, already in the store, no new
> endpoint. And the `/jazz/<season>` form shipped with increment 2 instead of
> waiting: the surface opens on the completed 2025-26 season so it renders
> before opening night, so the team registry carries `seasons[]` and a
> `canonicalSeason` exactly like a hero, and 2026-27 joins the list and becomes
> canonical by config change the day its payloads deploy. Game pages keep
> `/jazz/<gameId>`; a ten-digit id is never confusable with a season.

## Outcome

Build a Utah Jazz team surface inside Good Shots: one reserved route that
shows, for the living 2026-27 season, the team's season-to-date shot profile
against the league, a game-by-game ledger of exact facts, a roster rail with
every player's season-to-date profile and who feeds them, and, behind a local
review tool, a human-annotated record of every foul in every Jazz game.

The surface is a tool, not an argument. It carries structural copy only, no
verdict, and its honesty rides on visible counts and local flags (the ADR-0075
stance). Hero pages for Jazz players stay complete arguments at their own URLs
and are linked, never duplicated.

## Decisions already made

Chosen in the 2026-09-22 session:

- **Placement:** a team section inside Good Shots at a reserved `/jazz` route,
  sharing the navbar, footer, methodology page, and deployment. The directory
  and the non-Jazz heroes stay as they are.
- **MVP content:** all four increments are in scope: the game ledger, the team
  season-to-date profile, the roster rail with feeding, and the foul skeleton
  with its review tool. They ship in the order below.
- **Voice:** pure tool. Structural copy, counts, flags, and definitions. No
  per-game or season claims, so no verdict guards.
- **Roster scope:** the full active roster, observed nightly from the NBA
  roster endpoint, drives coverage. No hand-curated list.

Standing decisions that continue to apply, verbatim:

- ADR-0001/0002/0016: selection and making stay distinct and league-relative;
  the benchmark is the league's own diet.
- ADR-0004: rollups sum makes and attempts, never rates.
- ADR-0006/0010/0080: raw is append-only, the record store is the system of
  record, the app reads committed deployed payloads only.
- ADR-0011: presentation formats, never computes.
- ADR-0012/0019: data assigns zones; conflicts are dropped and counted.
- ADR-0023: displayed gaps subtract displayed anchors.
- ADR-0036: cross-source joins are exact, never nearest.
- ADR-0057/0058: the season loop publishes exactly through a reconciled
  frontier or not at all; lag defers, contradiction halts; the automated
  commit class is data-only.
- ADR-0075/0076: tool surfaces carry local sample flags and URL-owned state.
- The standing not-to-do list, in particular no trip estimator and no creation
  inference from Case 1 data.

## Decisions to record

Each of these needs an ADR before its increment merges. Proposed numbering
continues from ADR-0080.

1. **A team surface is a tool-class page that renders from game one.**
   Extends ADR-0075. A team page has no verdict, so the five hero gates do
   not apply; the frontier rule does. A single game is the thinnest data the
   product shows, and it shows it as counts with flags, never as a graded
   reading. ADR-0059's dark period exists to protect arguments; a tool with
   visible denominators has nothing to protect.
2. **The team shot payload is a fifth contract with the team as subject.**
   One team-wide shot pull (team ID set, player ID zero) returns every
   rostered player's shots with player identity and the league-averages
   frame. The contract reuses the enriched shot row plus a `playerId` per
   row, carries team metadata instead of hero metadata, has no usage field,
   and is fenced by a team FGA oracle (the league team-totals artifact's FGA
   must equal the pre-drop row count) plus a per-player oracle (each rostered
   player's row count must equal that player's FGA in the league Advanced
   artifact the loop already pulls). `aggregateShotMetrics` runs unchanged on
   any slice of its rows.
3. **Feeding is sourced from the passing dashboard and reconciled to
   play-by-play assist credit.** Per receiver, the passes-received rows name
   each passer with passes, assists, attempts, and makes, misses included.
   The exact oracle: the sum of assists across a player's passers equals the
   count of that player's made shots carrying assist credit in the
   play-by-play through the frontier (the ADR-0046 parser, already
   reconciled to box-score assists). A tracking gap is reported as a
   shortfall, never filled. No league baseline for feeding exists, so the
   section is descriptive (ADR-0038's stance).
4. **The game ledger is exact box facts plus a per-game decomposition.** Each
   row is the box team line (result, score, attempts, free throws) plus the
   headline pair computed by the unchanged aggregation over that game's team
   shots. Per-game zone grain is counts only, with no vs-league shading,
   because no zone clears the 15-attempt bar in one game. Team free-throw
   trips join the ledger when the team trip derive lands (increment 4).
5. **Human annotations are a third class of fact.** Neither sourced from the
   NBA nor authored copy: observed by a named reviewer against a versioned
   vocabulary, stored apart from observed NBA data, with unknown as a
   first-class value and a per-game completeness gate. Annotations never
   render beside exact numbers without their provenance stated. The record
   store stays product-blind: the annotation table knows players and games,
   never heroes.

## Domain language

Add to `CONTEXT.md` when the first increment lands. Use these words in code,
tests, docs, and product copy.

- **Team surface:** the `/jazz` page family. A tool, never an argument.
- **Team season-to-date profile:** the two-axis model with the team as
  subject, every rostered player's shots summed, measured against the league
  through the reconciled frontier, with local flags.
- **Game ledger:** the team's games in date order, one game row each, exact
  facts only.
- **Game row:** one game's box team line plus its headline decomposition
  (league diet PPS, expected from diet, actual PPS, the two deltas) over that
  game's shots, and its zone counts.
- **Team shot payload:** the fifth typed contract, team-scoped, per-shot rows
  with player identity plus the rolled-up league baseline.
- **Feeding:** who passed to a player before his shots, misses included, at
  the season-to-date grain. Sourced from the passing dashboard.
- **Feeder:** a passer named in a player's feeding rows.
- **Feeding payload:** the sixth typed contract, team-scoped: per receiver,
  per feeder rows plus the play-by-play assist-credit oracle values.
- **Roster rail:** the team surface's list of every rostered player, each a
  player profile linking a hero argument where one exists.
- **Player profile:** a rostered player's season-to-date shot counts and
  feeding, rendered with local flags. Not an argument. Not a hero page.
- **Roster snapshot:** a dated verbatim roster pull. The roster is observed
  nightly and drives coverage; a departed player's rows stay in the season
  record and leave the rail.
- **Foul event:** one foul action in a Jazz game as the play-by-play records
  it: game, period, clock, fouler, foul type, referee, penalty state, and the
  fouled player where the record names him (through the same-clock free
  throws or the same-clock made shot).
- **Fouls drawn / fouls committed:** a foul event from the Jazz's side.
  Fouls drawn are committed by the opponent and are the review priority.
- **Foul annotation:** a reviewer's assertions about one foul event under a
  versioned vocabulary.
- **Review queue:** the foul events of a game not yet annotated or marked
  unknown.
- **Game reviewed:** the completeness gate: every foul event of interest in
  the game is annotated or explicitly unknown.
- **Labeling guide:** the written standard a reviewer annotates against,
  versioned with the vocabulary.

Avoid: "team verdict", "team grade", "the Jazz are taking good shots" or any
whole-team claim; "assist" for a pass that produced a miss (a feeding row is
a pass, an assist is scorer credit); "hero" for a rail player without an
argument.

## Scope

### Included

- The `/jazz` team page and `/jazz/<gameId>` game pages for 2026-27.
- Nightly team pulls in the season loop: roster, team shot chart, missing
  play-by-play and box pairs, per-player passing, and the exports.
- The team shot payload and the feeding payload as new contracts with
  goldens, schemas, derives or exports, and deployed-pair guards.
- The game ledger from the box team line plus per-game decomposition.
- The roster rail with player profiles and feeding, linking hero pages for
  Keyonte George and Ace Bailey, and Peterson's when it is born.
- The foul event view, the foul annotation table, the local review tool, and
  the labeling guide.
- Team free-throw trips into the ledger, once the team trip derive lands.
- Methodology page additions explaining the tool class and the annotation
  class, in structural copy verified against the code.

### Excluded

- Any authored verdict, game note, or team claim.
- A Peterson hero page before his gates pass (ADR-0059 stands).
- Team creation tracking, lineups, on-off, opponent analysis, clutch.
- Rendering annotations on the public surface in this plan. Annotations
  accumulate; their first public surface is a later plan with its own
  honesty design.
- A deployed review tool. The tool is local-only in this plan.
- Video ingestion or computer vision of any kind.
- The record store as a browser read source. The app reads deployed JSON.
- NBA API calls from the browser or from any cloud environment.
- Team branding beyond the existing team-mark watermark practice. The team
  name is used descriptively in kickers and titles.

## URL contract

Reserve `/jazz` beside `methodology` and `compare` in the reserved static
routes, protected by the existing registry collision test.

```text
/jazz                      team page: profile, ledger, rail
/jazz/0022600123           one game row expanded: box line, decomposition, zone counts, per-player counts
```

Rules:

- The route parser already yields `{ slug: 'jazz', season: '<second segment>' }`
  for two segments; the app resolves `jazz` before the registry and reads the
  second segment as a game ID. A game ID not in the ledger renders the team
  page with a plain note, never the directory fallback.
- No query state in this plan. If a filter ever lands, it follows ADR-0076.
- The season is fixed to the config's live team season. A second season adds
  a `/jazz/<season>` form later, mirroring hero permalinks; do not design it
  now.

## Data semantics

### Nightly team session (the season loop)

`season.config.json` gains a `liveTeams` list:

```json
"liveTeams": [
  { "tricode": "UTA", "teamId": 1610612762, "team": "Utah Jazz", "season": "2026-27" }
]
```

The loop runs a team session after the hero sessions, in this order:

1. **Roster pull.** Verbatim `commonteamroster` snapshot under
   `data/raw/_teams/uta/2026-27/roster/`. Loaded to the record store with
   change detection; a roster change is expected, logged, and never a halt.
2. **Team discovery pull.** Team-wide `shotchartdetail` (team ID set, player
   ID zero, `FGA` context measure), unanchored. Yields the game list and
   dates exactly as the hero loop does.
3. **Missing pairs.** `pull_play_by_play.py --game-ids` for every game
   lacking a play-by-play and box pair. This step is the one hard
   opening-night requirement: every Jazz game's pair from game one.
4. **Frontier.** Candidate from pair availability, the existing rule. No
   tracking coherence search in this session (no team tracking contract).
5. **Anchored pulls.** The team shot pull at the frontier; then one
   `playerdashptpass` pull per rostered player, anchored with the same
   `DateTo`, about 1.5 seconds apart. Roughly twenty calls.
6. **Load and export.** Team shot rows and roster into the record store;
   passing rows into a new `pass_received` table; export the team shot
   payload, the feeding payload, and the ledger facts with every oracle
   enforced.
7. **Gates.** Frontier exactness across the team payloads, the team FGA
   oracle, the per-player FGA oracle, the feeding assist oracle. Any failure
   halts the team session with the existing toast; hero sessions are
   unaffected.
8. **Sync and commit.** Deployed copies under `public/data/_teams/uta/`, in
   the loop's data-only commit on green.

The no-change early exit applies: an identical discovery rowset and a deployed
frontier at the candidate means the session ends before anchored pulls.

### Team shot payload

- Deployed at `public/data/_teams/uta/2026-27.json`.
- `_meta`: schema version, `teamId`, `tricode`, `team`, season, season type,
  pull date, `dataThrough`, `gamesIncluded`, source snapshot, `totalShots`,
  `zoneConflictsDropped`, `teamFgaSource` (the league team-totals artifact
  path), `rosterSnapshot`.
- `shots[]`: the enriched shot row plus `playerId` and `playerName`, with
  `opponent` and `home` resolved from the team's side (the ADR-0028 static
  map, team-relative).
- `zoneBaseline[]`: unchanged shape, from the pull's league-averages frame.
- Oracles at export: `dataThrough` equals the max game date and
  `gamesIncluded` the distinct game count (the ADR-0058 refinements, reused);
  team pre-drop FGA equals the league team-totals FGA through the frontier;
  each rostered player's pre-drop row count equals his league Advanced FGA
  through the frontier. A player with rows who is not on the roster snapshot
  is legal (a departed player) and is reported.
- Golden: a truncated team snapshot fixture with three players and two games,
  regenerated by `golden:regen`.

### Feeding payload

- Deployed at `public/data/_teams/uta/2026-27.feeding.json`.
- `_meta`: schema version, team identity, season, frontier fields copied from
  the team shot payload (four-way equality becomes team-pair equality),
  `rosterSnapshot`, per-receiver source snapshots.
- `receivers[]`: per rostered player: `playerId`, `playerName`, games,
  `feeders[]` with `passerId`, `passerName`, `passes`, `assists`, `fgm`,
  `fga`, `fg2m`, `fg2a`, `fg3m`, `fg3a`, and the oracle pair
  `assistedMakesPbp` and `assistShortfall`.
- Oracles at export: for every receiver, the sum of feeder assists plus the
  reported shortfall equals the receiver's play-by-play assisted makes
  through the frontier; a tracking sum exceeding the play-by-play count is a
  contradiction and halts. Feeder attempts never exceed the receiver's team
  payload row count.
- Golden: a truncated passing fixture for the same three players.

### Game ledger

- Derived in TypeScript from the two deployed team payloads plus a small
  ledger facts file exported from `box_team_line`:
  `public/data/_teams/uta/2026-27.ledger.json` with one row per game:
  `gameId`, `gameDate`, `opponent`, `home`, `teamScore`, `opponentScore`,
  `fgm`, `fga`, `ftm`, `fta`, `technicalFreeThrows` (once the team trip
  derive lands), and the source pair's pull dates.
- The ledger's game set must equal the team shot payload's game set exactly.
- The React layer never tallies. A pure `aggregateTeamLedger` module slices
  the team shots by game, calls `aggregateShotMetrics` per game, and pairs
  each result with its ledger facts.

### Sample treatment

- Season-to-date: the six evaluation zones render with the ADR-0075 local
  flags. Attempts always visible.
- Per game: the headline pair renders with attempts visible and a plain
  thin-sample note when a game's attempts fall under the 50-attempt making
  bar (overtime games and blowouts vary). Zone grain is counts only.
- Player profiles: counts and PPS with attempts visible; zone shading only
  once a zone clears 15 attempts, exactly as the comparison page does.
- Feeding: counts only; a feeder row under a small threshold stays visible
  with its denominator. No rates without denominators.

### Foul skeleton

- `foul_event` is a **view** over `pbp_event` (the record store computes
  derived facts as views, ADR-0080): every action typed Foul in a game the
  team played, joined laterally to the same-clock free-throw or made-shot
  event to name the fouled player where the record does. Columns: game,
  action number, period, clock, fouling team, fouler, foul subtype, referee
  parsed from the description, penalty and team-foul counts parsed from the
  description, fouled player or null, `drawn` (true when the fouler is the
  opponent), and the video flag.
- `foul_annotation` is a **table**, the only new human-owned table:
  `game_id`, `action_number`, `vocab_version`, `reviewer`, `reviewed_at`,
  `status` (annotated or unknown), `zone` (one of the six evaluation zones,
  human-picked, nullable), `loc_x`, `loc_y` (the court click in the NBA's
  tenths-of-feet frame, nullable), `ball_status`, `play_type`,
  `fed_by_player_id`, `defenders_within_reach`, `note` (140 characters).
  Every enum carries an `unknown` member.
- Vocabulary v1: `ball_status` in with ball, without ball, unknown;
  `play_type` in drive, post up, jumper, cut, transition, rebound or loose
  ball, off ball, unknown; `defenders_within_reach` in zero, one, two plus,
  unknown. Additions travel by migration with a version bump. Rows never
  rewrite under a new version.
- Zone is human-picked because no NBA zone exists for a click and the
  product has never assigned zones geometrically (ADR-0012). The click is
  the fine-grain supplement; a geometric classifier may later grade the
  picks, never replace them.
- Review priority is fouls drawn. Fouls committed sit in the same queue at
  lower priority and may stay unknown without blocking a game's review of
  its drawn fouls; "game reviewed" is defined over fouls drawn in v1.

### Review tool

- Local-only. A second Vite entry (`review.html`) excluded from the
  production build, so it reuses the court drawing and the geometry module
  for exact click-to-court mapping, plus a small local Python API (FastAPI
  or the standard library) writing to the record store through the existing
  DSN resolution. Nothing in `dist/` ever reaches the database.
- Queue view: the team's games newest first, each with drawn, reviewed, and
  pending counts. Game view: the foul events in clock order with prefilled
  facts, a deep link per event to the NBA's clip page keyed by game ID and
  action number (the URL pattern is verified in increment 4, not assumed),
  the half-court for the click, the vocabulary controls, and Unknown as a
  one-click state.
- Writes are upserts keyed by game and action number. A row's reviewer and
  time are recorded on every write.
- `docs/foul-review/GUIDE.md` is the labeling guide, versioned with the
  vocabulary. Written before the first real annotation. A mid-season
  re-review of a random sample of twenty fouls measures drift.

## Domain implementation

New pure modules, no React logic:

- `src/domain/teamShotPayload.ts`: schema and parse for the team shot payload.
- `src/domain/feedingPayload.ts`: schema and parse for the feeding payload.
- `src/domain/ledgerFacts.ts`: schema and parse for the ledger facts.
- `src/domain/aggregateTeam.ts`: season-to-date profile (one
  `aggregateShotMetrics` call over all rows), per-player profiles (one call
  per player slice), and the game ledger (one call per game slice), each
  paired with its facts and carrying local flags. Asserts the ledger and
  payload game sets are identical and that every receiver in the feeding
  payload appears in the roster or is marked departed.

`aggregateShotMetrics` remains the only implementation of selection and
making math. Displayed gaps use `formatSignedGap`.

Python side:

- `ingestion/live_pulls.py`: `pull_roster_snapshot`, `pull_team_shot_snapshot`,
  `pull_passing_snapshot`, each anchored and append-only.
- `ingestion/load_team_season.py`: roster, team shots, passing into the
  record store with change detection and both FGA oracles.
- `ingestion/export_team_shot_payload.py`, `export_feeding_payload.py`,
  `export_ledger_facts.py`, each with `--verify-against`.
- `ingestion/season_update.py`: the team session, sharing the frontier and
  commit machinery.
- `db/migrations/0007_team_surface.sql`: `roster_snapshot`, `pass_received`,
  the `foul_event` view. `0008_foul_annotation.sql`: the annotation table.

## Page structure

### Team page `/jazz`

1. **Header.** Kicker `Utah Jazz · 2026-27`, an `h1` naming the surface as a
   tool ("Utah Jazz shot profile"), the frontier byline (data through, games,
   shots), and the league baseline season. No action banner, no thesis
   question, no verdict cue. The team mark may appear as the existing
   watermark treatment and nothing more.
2. **Season-to-date profile.** The headline pair (selection and making vs
   league) over the zone table with local flags. The court renders in Zones
   view with the making scale once zones clear their bars; before that,
   unpainted zones with counts, the existing no-data treatment.
3. **Game ledger.** A table, newest first: date, opponent, result, attempts,
   free throws, the headline pair for that game with its thin-sample note,
   and a link to the game page. Structural caption naming what a game row is
   and is not.
4. **Roster rail.** Every rostered player as a compact profile: headshot,
   name, number, season-to-date attempts and PPS with flags, top feeders by
   passes with attempts and makes on those passes, and a link to the hero
   argument where one exists. Departed players with rows in the season are
   listed under a separate "no longer on the roster" caption.
5. **Notes.** The tool-class explanation in one line, linking the methodology
   page's new section.

### Game page `/jazz/<gameId>`

1. Header with date, opponent, result, and the team page link.
2. The box team line as exact facts.
3. The headline pair for the game with its note.
4. Zone counts (attempts and makes per zone, counts only).
5. Per-player counts for the game (attempts, makes, points, free throws
   from the box line).

No comparison to other games, no trends, no notes about why.

## Proposed file seams

```text
src/
  app/
    TeamPage.tsx
    TeamPage.test.tsx
    TeamGamePage.tsx
    TeamLedgerTable.tsx
    RosterRail.tsx
    teamRoute.ts
  domain/
    teamShotPayload.ts
    feedingPayload.ts
    ledgerFacts.ts
    aggregateTeam.ts
    aggregateTeam.test.ts
    teamPayloads.real.test.ts
ingestion/
  load_team_season.py
  export_team_shot_payload.py
  export_feeding_payload.py
  export_ledger_facts.py
  test_team_season.py
db/migrations/
  0007_team_surface.sql
  0008_foul_annotation.sql
tools/foul-review/
  review.html
  ReviewApp.tsx
  server.py
docs/foul-review/GUIDE.md
tests/fixtures/
  team-snapshot.truncated.json
  team-shot.golden.json
  passing.truncated.json
  feeding.golden.json
```

Touch existing files only at their seams: `src/App.tsx` (resolve the
reserved route), `src/app/routes.ts` (the route name), `season.config.json`
(`liveTeams`), `ingestion/season_update.py` (the team session),
`ingestion/live_pulls.py` (three pull functions), `scripts/sync-hero-payload.ts`
or a sibling script for team payloads, `src/App.css`, `CONTEXT.md`,
`docs/ROADMAP.md`, the methodology page's structural copy.

Do not make `HeroConfig` carry team data. The rail reads the roster snapshot
from the team payload and looks up hero slugs by player ID through a small
registry helper.

## Test plan

### Python

- Team shot export equals the golden for the truncated fixture.
- Team FGA oracle failure halts; per-player FGA oracle failure halts.
- Feeding export equals its golden; the assist oracle passes on the fixture,
  a manufactured over-count halts, a manufactured under-count reports a
  shortfall.
- The ledger facts game set equals the team payload game set.
- The `foul_event` view names the fouled player through free throws and
  through a same-clock made shot, and leaves him null otherwise, on the
  existing play-by-play fixture.
- Record-store tests run against the ephemeral Postgres, skipping loudly
  without Docker, as today.

### TypeScript

- Both new goldens strict-parse; unknown keys fail.
- `aggregateTeam` slices by game and by player without double counting:
  season totals equal the sum of game totals equal the sum of player totals.
- Every game row's headline identity holds as displayed.
- The reserved route resolves before the registry; `jazz` can never become a
  hero slug.
- Component tests under jsdom with explicit cleanup: header, profile, ledger,
  rail, thin-sample notes, departed-player caption, the game page, and the
  plain-error contract.
- No verdict, claim, or grading vocabulary appears on the team surface (a
  copy guard in the spirit of `heroCopy.test.ts`).
- The deployed-pair real-data guard: the three team payloads share one
  frontier and game set, skipping on clean clones.

### Replay

- Before activation, drive the team session with `--as-of` over three
  2025-26 dates against the committed 2025-26 corpus, holding the exported
  team payload to the union of the hero payloads' Jazz shots on those dates.
  The season replay script gains a `--team` mode or a sibling script.

### Repository gates

```text
python -m pytest ingestion -q
npm test
npm run lint
npm run build
```

## Implementation sequence

Opening night is the week of October 19. The one thing that must exist by
then is step 3 of the nightly team session: every Jazz game's play-by-play
and box pair pulled from game one, and the team discovery pull recording the
game list. Everything else can land in November against raw that has been
accruing, because raw is append-only and every export rebuilds from it.

### Increment 1: team data spine (target: end of September)

- Config `liveTeams`, the three pull functions, the roster and team shot
  loaders, the team shot payload schema, export, golden, and oracles.
- The team session in the loop through gates, syncing under `_teams/uta/`.
- Prove it on 2025-26 with the replay dates above.
- ADRs 1 and 2 written.

### Increment 2: the team page (target: opening night)

- Reserved route, `TeamPage`, header, season-to-date profile, the ledger
  from ledger facts plus per-game decomposition, the game page.
- `aggregateTeam` and its tests. Methodology section on the tool class.
- ADR 4 written. CONTEXT.md terms added.

### Increment 3: feeding and the rail (target: early November)

- Passing pulls in the session, `pass_received`, the feeding payload with
  the assist oracle, golden, deployed-pair guard.
- `RosterRail` with player profiles and feeders; hero links; departed caption.
- ADR 3 written.

### Increment 4: the foul record (target: mid November)

- Migrations 0007's view and 0008's table. The labeling guide. The review
  tool with the verified clip deep link. First real annotations on games
  already in the corpus.
- Team free-throw trips: the trip grammar over every team free-throw event
  per game, reconciled to the box team line, and-ones joined to the team
  shot payload; technicals into the ledger facts.
- ADR 5 written.

Each increment leaves the suite green and a usable vertical slice. Do not
build the rail before the team payload's oracles are proven, and do not
start annotating before the guide exists.

## Acceptance criteria

Without any authored prose, a reader on `/jazz` can answer:

- What is the team's shot diet worth against the league's, and how has the
  team converted against its own diet, through what date and over how many
  shots?
- How did last night's game break down, in exact box facts and in the
  headline pair, with the sample stated?
- Who is on the roster, how much has each player shot from where, and who
  has been feeding him, misses included?
- Which numbers are thin, and by how much?

And the operator can answer, from the review tool alone:

- How many fouls did the Jazz draw last night, how many were shooting fouls,
  and which ones remain to review?

## Open questions

- **Clip deep link.** The NBA's per-event clip page URL pattern must be
  verified against a real game before the review tool depends on it. If no
  stable pattern exists, the tool shows period and clock and the reviewer
  navigates the broadcast manually.
- **Departed players' passing pulls.** A player traded away mid-season keeps
  his rows in the team payload; whether the session keeps pulling his
  passing rows through his last Jazz game or stops at departure is a
  frontier question to settle in increment 3.
- **Peterson's hero add.** Unchanged by this plan: born live when his gates
  pass. His rail profile renders from game one as counts, which is the
  parking-lot answer for rookies pre-flip made concrete.
- **Roadmap and not-to-do list.** The roadmap gains this plan's status row,
  and the not-to-do list's "no database in the product architecture" line
  is stale since ADR-0080 and should be rewritten in the same PR.
