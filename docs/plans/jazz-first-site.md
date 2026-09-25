# Jazz-First Site Plan

_Drafted 2026-09-24 from a direction review. Supersedes
`docs/plans/jazz-surface.md` (branch `proto_VideoAnalysis`, 2026-09-22)
wherever the two disagree; everything that plan decided and this one does not
mention still stands. Decisions to record are listed under "Decisions to
record" and each lands as an ADR with the increment that needs it._

## Outcome

Good Shots becomes a Utah Jazz site for the 2026-27 season. The root opens
on the Jazz. After every game, the site publishes a shareable **game report
card** that answers the product's own question twice: _were they good
shots, and did they fall?_ From the card, a reader drills into any player's
night, and from there into that player's running season. The season-long
**arguments** (the authored, guarded hero pages) continue for three Jazz
players and stay frozen for everyone else.

The point of the season is consistency: a card that ships after every Jazz
game, all season, built on the same exactness and honesty rails as
everything else here.

## Decisions already made

Chosen 2026-09-24 (the defaults of the direction review, accepted):

- **No letter grades.** Game-grain copy uses the verdict ladder's priced
  words and computed ranks, never grades.
- **Game-night freshness.** The report card publishes the night of the game
  where the sources allow it; the morning run is the catch-up and the
  reconciliation pass.
- **The foul review tool is deferred** to January at the earliest. ADR-0085
  stays as recorded; neither the `foul_event` view nor the review tool is in
  this plan.
- **Living arguments for three Jazz players:** Ace Bailey, Darryn Peterson,
  and Keyonte George (his extension makes his 2026-27 season a natural
  argument). Each flips when its own five gates pass.
- **League-wide nightly context in November**, after a short spike.
- **No read API before December.** The site stays static; see "Data".
- **The pre-game ruler** (approved later the same day). Every game is priced
  against the league as it stood entering that day, with the labeled
  prior-season fallback for the thin first nights. The phase 2 measurement
  sets the fallback's bar or removes the fallback; it does not reopen the
  ruler itself. Recorded as ADR-0089 when phase 2 lands.
- **Nothing from the 2026-09-22 plan is sacred.** Where this plan differs,
  this plan wins.

Standing decisions that continue to apply:

- ADR-0001/0002/0016: selection and making stay distinct and league-relative.
- ADR-0004: rollups sum makes and attempts, never rates.
- ADR-0007/0011: payloads carry observations, the browser computes metrics,
  presentation formats and never computes.
- ADR-0009: `aggregateShotMetrics(shots, zoneBaseline)` is the only
  implementation of selection and making math. A different ruler is a
  different baseline argument, never a second implementation.
- ADR-0012/0019: zones come from `shotchartdetail`; conflicts are dropped
  and counted.
- ADR-0023: displayed gaps subtract displayed anchors.
- ADR-0036: cross-source joins are exact.
- ADR-0053/0055: no trip estimator, technicals are never trips.
- ADR-0057/0058: publish exactly through a reconciled frontier or not at
  all; lag defers, contradiction halts.
- ADR-0060: hero URLs are permanent. Every `/<slug>` and `/<slug>/<season>`
  that exists today keeps working.
- ADR-0075: tool surfaces carry local sample flags, never suppression.
- ADR-0080: the record store is the system of record, product-blind.

## Where things stand (verified 2026-09-24)

- **main** (`a857734`): eleven heroes, all 2025-26 arguments; the season
  loop runs on the record-store engine; one live season configured (Ace
  Bailey 2026-27, dark).
- **`proto_VideoAnalysis`** (2 commits, both 2026-09-22, fast-forwards from
  main): the Jazz plan, ADRs 0081-0085, increment 1 (the `liveTeams` team
  session: roster, team-wide shot pull, missing pbp/box pairs, the team shot
  payload with per-game box oracles, `--team <tricode>` flag) and increment 2
  (`/jazz`, `/jazz/<season>`, `/jazz/<gameId>`, `TeamPage`,
  `TeamGamePage`, `aggregateTeam`, ledger facts), rendering 2025-26.
  Migration `0007_team_shots.sql`.
- **`proto_GameCard`** (5 commits, descends from main): its own ADR-0081
  (game cards) plus the ADR-0053 split-trip amendment; `24c1903` design,
  `5e818ad` the game-log contract and `/game` pages for the eleven heroes,
  `316ef12` the split-trip families (freethrow v3, game log v2, migrations
  `0007_twelve_minute_clock.sql` and `0008_split_trip_families.sql`,
  `import_card_roster.py`), `ccbe994` **data only** (285 files under
  `public/data/games/`, about 1.97M lines, the 284-player roster), `c84644e`
  the spectrum research doc.
- **The production store** has migrations 0001-0008 applied, including both
  of `proto_GameCard`'s, but **not** `0007_team_shots.sql`. It holds 185,684
  shots and play-by-play for all 1,230 games of 2025-26 (the card-roster
  import), 269 MB in total.
- **A trial merge** of `proto_VideoAnalysis` with `316ef12` conflicts in
  four files: `CLAUDE.md`, `src/App.css`, `src/App.tsx`,
  `src/app/routes.ts`. `load_game_corpus.py` and `load_hero_season.py`
  auto-merge but were changed on both sides, so they need a real test run.
- **`season_update.py` commits and pushes on whatever branch is checked
  out.** There is no branch check.
- **The raw layer is 648 MB on one laptop**, gitignored, with no copy
  anywhere else. Play-by-play is 457 MB of it.
- **There are no Vercel cron jobs for this project.** The loop is a Windows
  Task Scheduler job (`scripts/season-update.ps1`). A Vercel cron cannot
  replace it: stats.nba.com blocks cloud IPs, which is why the loop is local
  in the first place.
- **The scheduled task misses days.** Twelve run logs since 2026-08-25, with
  gaps of September 7 to 14, 21, 23, and 24, and start times drifting from
  06:30 to mid-afternoon. The 2026-09-24 attempt was refused at 8:40 with
  result `0x800710E0`. The task is registered "Interactive only" with "No
  Start On Batteries" and "Stop On Battery Mode", so the likeliest cause is
  the laptop running on battery. A missed day in the season is a missing
  report card.

## Decisions to record

Numbering assumes the integration below: the Jazz ADRs keep 0081-0085, the
game-card ADR is renumbered to 0086, and new decisions start at 0087. Each
ADR lands with the increment that needs it.

1. **ADR-0086, game cards (renumbered).** Merged as decided on 2026-08-25,
   with a supersession note: the mechanical 284-player roster and the
   game-log contract are superseded by ADR-0088 for the product; the poster
   and receipt design, the priced-facts stance, and the receipt identity
   carry forward.
2. **ADR-0087, the site root is the Jazz home.** `/` renders the Jazz team
   season. The directory of arguments moves to `/arguments`, Jazz arguments
   first. Every argument except the three living ones is frozen: no new
   seasons, no copy work, URLs permanent. That includes Cody Williams's
   2025-26, which stays a Jazz argument though he is off the roster. The navbar stays the wordmark (ADR-0065); the
   footer gains an Arguments link. Amends ADR-0022 and ADR-0065.
3. **ADR-0088, the game payload.** One immutable file per game, both teams,
   carrying everything a report card and a player's night need. Supersedes
   the game-log contract (ADR-0086) and the ledger facts file (ADR-0084's
   export, replaced by the season index). See "Data".
4. **ADR-0089, the pre-game ruler** (decided 2026-09-24; the ADR records
   it). Every game is priced against the league
   as it stood entering that day: the `LeagueAverages` frame anchored at the
   day before the game. Until the current season's baseline clears a named
   per-zone bar, games are priced against the prior season's full baseline,
   and the card says which. Season-to-date views keep the frontier ruler, as
   hero pages do today. See "Data".
5. **ADR-0090, computed copy.** A fourth class of copy beside structural
   copy, authored verdicts, and human annotations: sentences authored once as
   templates, filled mechanically, each template guarded by the predicate
   that licenses it. It amends ADR-0081's no-graded-reading rule for the team
   surface, and only through templates. No letter grades, no causal language.
6. **ADR-0091, game-night publishing.** The team session gets a late-night
   window on game nights, and the data commit class admits generated share
   images derived only from that commit's payloads and committed assets.
   Amends ADR-0057.
7. **ADR-0092, league team-game context** (phase 4). Nightly league-wide
   team shot pulls load into the record store; a league team-game tallies
   contract lets the browser rank any Jazz game against every team-game of
   the season.
8. **ADR-0093, one derive engine** (phase 5). The file derive engine
   retires; derive grammars stay as libraries the loaders import; goldens
   regenerate through the record store. Rewrites the not-to-do list's stale
   "No database in the product architecture" line.
9. **ADR-0006 amendment: the raw layer is mirrored off-machine** nightly.
   The layer's semantics (append-only, verbatim, local pulls) are unchanged.

## Scope

### Included

- Integrating both prototype branches into one line of history.
- Loop operations: its own clone on main, pull-first, a branch guard, a
  wake timer, a game-night window, the raw backup.
- The game payload, the pre-game ruler, per-game share cards and emitted
  share pages.
- The team report card, the player's night, the player season page, the
  season page with its game quadrant, the roster rail.
- The 2025-26 Jazz season published as 82 report cards before opening night.
- Computed copy: the two headline answers and season superlatives.
- Living arguments for Keyonte George, Ace Bailey, and Darryn Peterson.
- League team-game context and feeding (phase 4).
- Retiring the file derive engine (phase 5).

### Excluded

- Letter grades, team verdicts, and causal claims ("the defense forced").
- The foul review tool and the `foul_event` view.
- A read API or any runtime database access from the site (revisit in
  December).
- New arguments for non-Jazz players.
- The 284-player league roster as a published surface. Its data stays in
  the store; the data commit `ccbe994` never enters main.
- SLC Stars (a December spike at the earliest, see "Open questions").
- Team logos or marks beyond the existing watermark practice.
- Any NBA API call from the browser, from CI, or from Vercel.

## Branch integration

Do this first, on an integration branch, before any new build.

1. Create `feature_JazzSite` from `proto_VideoAnalysis` (it fast-forwards
   from main, so this is main plus the two Jazz commits).
2. Renumber the game-card ADR **before** merging, on a throwaway branch
   from `316ef12`: rename the ADR file to `0086-...`, replace `ADR-0081`
   with `ADR-0086` everywhere on that branch (34 references; main has no
   ADR-0081, so a global replace is safe there), commit.
3. Merge that renumbered commit into `feature_JazzSite`. This brings the
   design, the phase-1 game cards, and the split-trip grammar, and leaves the
   data commit `ccbe994` out of main's history for good. Resolve the four
   conflicts. Routes: keep both reserved families for now; the `/game` route
   retires in phase 3.
4. Cherry-pick `c84644e` (the spectrum research doc).
5. Rename `db/migrations/0007_team_shots.sql` to `0009_team_surface.sql`.
   The production store never applied it (verified), so the rename is safe;
   `0007_twelve_minute_clock.sql` and `0008_split_trip_families.sql` keep
   their names because the store has them recorded.
6. Apply `0009` to the production store, then run the full gate: pytest
   with Docker running (the record-store tests skip silently without it, so
   check the count ran, not just that it passed), `npm test`,
   `npm run lint`, `npm run build`. The two auto-merged loaders are the ones
   to watch.
7. Re-run the team replay from the Jazz plan (three 2025-26 `--as-of`
   dates) on the merged code.
8. Update `jazz-surface.md` with a pointer to this plan and merge
   `feature_JazzSite` to main by PR.

Known local state to ignore: `freethrowPayload.real.test.ts` fails eleven
cases on this machine because local derived free-throw payloads were
rewritten at v3 while the deployed copies are v2. The merge brings the v3
deployed copies and should clear it; if it does not, that is a real finding.

## Operations

Each of these is small, and all of them land before opening night.

- **Give the loop its own clone.** Clone the repo to
  `..\nba-analytics-loop` and keep it on main. (A worktree will not do: git
  refuses to check out main in two places, and the dev checkout needs main
  too.) Junction its `data\` to the dev checkout's `data\` so both share the
  one raw layer (gitignored, so a fresh clone has none), copy `.env`,
  `npm ci`. Re-register the scheduled task to run that clone's
  `season-update.ps1`.
- **Pull before the session.** The loop never pulls today, so a PR merged
  on GitHub makes its next push fail. The wrapper runs
  `git pull --ff-only` first; a failed pull halts with the toast.
- **Branch guard.** `season_update.py` halts, with the existing toast,
  unless it is on main with no staged or unstaged changes outside
  `public/data/` and `data/`. The separate clone is the fix; the guard is
  the backstop.
- **Wake timer and power.** _Applied 2026-09-24 to the current task; repeat
  for any task registered later (the loop clone's, the game-night
  trigger)._ In the Conditions tab, tick "Wake the computer to run this
  task" and untick "Start the task only if the computer is on AC power". In
  the Settings tab, tick "Run task as soon as possible after a scheduled
  start is missed" (without it, a morning the laptop sleeps through is
  skipped, not caught up) and cap "Stop the task if it runs longer than" at
  2 hours (a hung run blocks the next day's until the cap; the default is 3
  days). Leave it running only when you are logged on (a toast needs a
  logged-in session, and sleep keeps you logged in). A session is a few
  minutes of network and CPU, so battery drain is not the concern.

  **The grayed-out box trap.** Unticking the AC-power box grays out "Stop if
  the computer switches to battery power" but leaves it set, and the dialog
  cannot clear it. Clear it from PowerShell, then read the settings back to
  confirm all five:

  ```powershell
  $t = Get-ScheduledTask -TaskName "nba-analytics season loop"; $t.Settings.StopIfGoingOnBatteries = $false; Set-ScheduledTask -InputObject $t
  (Get-ScheduledTask -TaskName "nba-analytics season loop").Settings | Select-Object DisallowStartIfOnBatteries, StopIfGoingOnBatteries, WakeToRun, StartWhenAvailable, ExecutionTimeLimit
  ```

  **This laptop uses Modern Standby** (`powercfg /a` reports S0 Low Power
  Idle), and its power plan allows wake timers plugged in only. Leave them
  off on battery (a laptop that wakes in a closed bag overheats) and keep it
  plugged in overnight during the season; a run missed on battery catches
  up when the lid opens. The first 06:30 run log after the change is the
  real test that the wake works. If missed runs still pile up in November,
  a small always-on machine at home is the upgrade (a residential IP, so
  stats.nba.com still answers); the loop would then need a shell wrapper
  and a push notifier instead of the WinRT toast.
- **Game-night window.** A second daily trigger at 23:45 MT running
  `npm run season:update -- --team UTA`. On a night without a Jazz game the
  no-change early exit ends it after one discovery pull. If a source lags
  (a late West Coast finish, pbp not yet posted), the game defers to the
  06:30 run, which also runs the hero sessions and their tracking.
- **Raw backup.** You create a private bucket (Cloudflare R2 or S3) and
  credentials; the loop's last step syncs `data/raw` to it. The first sync
  uploads all 648 MB; after that, each night adds only the new snapshots.
- **Store headroom.** The store is 269 MB. Check the Neon plan's storage
  cap before phase 4 adds a season of league-wide shots.
- **Config.** `liveSeasons` gains `keyonte-george` and `darryn-peterson`
  for 2026-27 in dark mode (Peterson's player ID from the roster snapshot).
  `liveTeams` keeps UTA 2026-27 dark until opening night.

## URL contract

```text
/                                   the Jazz home (canonical team season)
/jazz                               same page, canonical alias
/jazz/2025-26                       a team season
/jazz/2026-10-22-lac                team report card
/jazz/2026-10-22-lac/keyonte-george a player's night
/jazz/keyonte-george                a player's running season (canonical season)
/arguments                          the directory of season arguments
/<slug>, /<slug>/<season>           hero arguments, unchanged
/methodology, /compare              unchanged
```

Rules:

- A game slug is the date plus the opponent's lowercase tricode. The NBA
  never schedules a team twice on one day, so it is unique per team. Payload
  files stay keyed by game ID; the season index maps slug to ID.
- Segment patterns never collide: a season is `\d{4}-\d{2}`, a game slug
  `\d{4}-\d{2}-\d{2}-[a-z]{3}`, a player slug has letters first. Team route
  parsing lives in `src/app/teamRoute.ts`; `parseRoute` resolves the
  reserved first segment and hands off.
- A player slug under `/jazz` resolves against the season's roster snapshot
  plus departed shooters. A player who has a hero argument gets a link to it;
  the two pages link each other (tool and argument, the ADR-0075 split).
- `/game/...` from `proto_GameCard` was never deployed and retires in
  phase 3.
- Share pages: the build emits `dist/jazz/<game-slug>/index.html` for every
  published game, with its card as `og:image`, and fails if a published game
  lacks its card (the ADR-0067 rule).

## Data

### The layers

| Layer | Today | This plan |
| --- | --- | --- |
| Raw snapshots | Files, one laptop | Files, mirrored nightly to a bucket |
| Record store (Neon) | System of record, production engine | Unchanged; the only engine from phase 5 |
| File derives | Fallback engine, golden generator | Retired in phase 5; grammars stay as libraries |
| Published payloads | Committed JSON, static app | Committed JSON, static app, with immutable per-game files |

### Published files for a team season

Under `public/data/_teams/uta/`:

- `<season>.json`: the **team shot payload** (ADR-0082), unchanged. Every
  Jazz shot of the season with player identity, the frontier ruler, the
  roster. Living, rewritten when the frontier moves. Read by season views.
- `<season>/index.json`: the **season index**, replacing
  `<season>.ledger.json`. Frontier fields, the roster snapshot, and one row
  per published game: game ID, slug, date, opponent, home, both scores, the
  box team line, and that game's ruler (kind, season, through-date, zone
  tallies). Small, living.
- `<season>/games/<gameId>.json`: the **game payload** (ADR-0088).
  Immutable once published.

### The game payload

- `_meta`: schema version, game ID, date, season, season type, the team and
  the opponent (team ID, tricode), home, the ruler (kind `pre-game` or
  `prior-season`, its season and through-date), source snapshots, and per
  side the zone conflicts dropped, technical free throws, and split free
  throws.
- `sides[]`, the Jazz first: team identity, score, the box team line, the
  per-player box lines, `shots[]` (the enriched shot row plus `playerId` and
  `assistStatus`), and `trips[]` (the ADR-0053 v3 trip row plus `playerId`).
- `zoneBaseline`: the ruler, in the existing shape, so each file is
  self-contained (the house pattern).

Sources: the Jazz side comes from the team session's existing pulls. The
opponent side needs one extra call per game, a team-wide `shotchartdetail`
for the opponent with `DateFrom` and `DateTo` set to the game date; phase
4's league pulls make it redundant. Box lines, trips, and assist statuses
for both sides come from the game's pbp/box pair, which is already required.

Oracles at export (hard-fail, ADR-0080's discipline, born DB-native with no
file derive):

- Per player per side, pre-drop shot rows equal box FGA.
- Per player per side, trips plus technicals plus splits equal the box
  free-throw line (the v3 identity).
- The receipt identity per player and per side: priced field-goal points
  plus unpriced (heave, conflict) field-goal points plus trip FTM plus
  technical FTM plus split FTM equals box points.
- Assist statuses reconcile per team to box assists (ADR-0046).
- The Jazz side's shots equal the team shot payload's slice for that game,
  exactly (re-asserted by a deployed-pair guard).
- The ruler equals the recorded league snapshot for its through-date.

Immutability: the loop writes a game file once. A later source change to a
published game is a changed row, which halts (ADR-0080); a human decides
whether it is a correction, and a correction travels by PR with a note.

Golden: a truncated two-team fixture of one game, generated through the
record-store path (the `regen_gamelog_golden.py` pattern).

### The pre-game ruler

Why not the frontier ruler for cards: on game night the frontier's league
frame can include games still in progress, the card would change every
morning after it was shared, and ranks across the season would mix rulers
without saying so. Why not last season's baseline all year: it compares
2026-27 shots to 2025-26 shooting, against the reasoning of ADR-0061 (each
season measured against its own league).

The pre-game ruler is complete before tip-off, identical for every game on a
date, reproducible, and never changes. It costs one call per Jazz game day:
a league frame anchored at the day before. The frontier-anchored pulls
cannot be relied on for it, because on the morning after a night the Jazz
did not play, the no-change early exit skips them.

The early-season fallback exists because a baseline built from two nights of
games is thin. It borrows last season's ruler for those nights, against the
reasoning above, which is why it is labeled on the card and why the
measurement below may remove it. The bar is a named constant, per evaluation zone, in league
attempts. **Set it from data, not from taste:** during phase 2, compute
2025-26's day-by-day as-of baselines from the stored corpus and measure how
far each game's selection value moves between its pre-game ruler and the
season-end ruler. If the movement is small everywhere after a week or two,
that is the bar. If it is small everywhere from night one, drop the
fallback.

Season-to-date views (the season profile, a player's season zones) use the
frontier ruler, labeled as such. Anything plotted per game, including the
quadrant and the ledger's decomposition, uses each game's own card values,
so a dot always matches its card.

## Pages

Every page is built on the existing identity: dark only, Big Shoulders
Display at poster scale, Public Sans and Plex Mono, the making scale, the
court. The report card layout is chosen by a three-variant throwaway
prototype on real 2025-26 games (the comparison and game-card precedent),
then rewritten properly.

### The Jazz home, `/`

1. **Latest game.** The latest game's report card header (score, the two
   answers), linking the full card. Before opening night, the last game of
   2025-26.
2. **The season so far.** The season profile against the league (frontier
   ruler), with local flags.
3. **The game quadrant.** Selection delta across, making delta up, one dot
   per game from its card, the latest highlighted, each dot a link. The four
   corners carry structural labels that define the model's outcomes, never
   a grade.
4. **The ledger.** Games newest first: date, opponent, result, the two
   numbers, a link.
5. **The roster.** Headshot, name, number, season attempts and PPS, links
   to the player's season and to an argument where one exists. Departed
   shooters under their own caption.
6. **Arguments.** The three Jazz arguments, then a link to `/arguments`.

### The team report card, `/jazz/<game-slug>`

1. Header: both teams, the score, date, home or away, the season link.
2. **Good shots?** The Jazz diet priced at the ruler against the league's
   diet, with its computed answer and, when phase 4 lands, the league rank.
3. **Did they fall?** Actual PPS against expected from the diet, with its
   computed answer.
4. The court: tonight's shots, made and missed; zone counts only (no zone
   shading at game grain, ADR-0084).
5. The opponent's shots, the same two numbers, described, never credited to
   the defense.
6. The line: trips by class and FT points, both sides.
7. The credit: assisted share of makes, both sides, with unknowns shown.
8. Players: each Jazz shooter's attempts, points, expected from diet,
   conversion, trips, linking his night.
9. The ruler, stated in one structural line.

No small-sample flag on game-grain values (ADR-0086's stance: selection is
priced choices, conversion is what happened, nothing estimates a rate). The
attempt count sits beside every value.

### A player's night, `/jazz/<game-slug>/<player-slug>`

The game-card design from `proto_GameCard`, reading a player slice of the
game payload: expected from his diet, scored, conversion, the LINE and
CREDIT chips, and the receipt itemizing every attempt and trip down to his
box total. Prev and next links walk his games.

### A player's season, `/jazz/<player-slug>`

His quadrant (one dot per game), his season zones against the league with
ADR-0075 flags, a game table linking each night, and the argument link.
Every rostered player gets one, from his first game. This is where
Peterson lives before his gates pass.

### Share cards

A 1200×630 card per game: the score, the two answers, a small court. Built
by a script alongside `cards:generate`, from committed data and assets only,
run by the loop in the same session that publishes the game.

## Computed copy

Templates are authored once, in the author's voice, red-penned like any
verdict, and kept in one registry. A template has a predicate over computed
metrics and a rendering; the renderer emits a sentence only when its
predicate holds.

- **The two answers.** One template per verdict ladder band for selection,
  one per band for making. Illustrative only, to be authored: "Good shots,
  and they fell." / "Good shots that didn't fall." The same band always
  produces the same words, on every card.
- **Season superlatives, scoped by their words.** "Most threes in a game
  this season (47)." "Best diet of the season so far." Current season only,
  Jazz games only, until phase 4 adds league scope, which says so.
- **Player notes.** Season highs by zone or by trips, same rules.

Guards: every template is exercised over the golden and every deployed game
payload, asserting predicate and emission agree; the punctuation rules of
`heroCopy.test.ts` apply; a copy guard forbids grade and causal vocabulary.
A card shows at most three superlatives, ordered by a declared salience.

Before authoring the band words, compute the distribution of 2025-26
per-game selection and making deltas. Game-grain making swings far wider
than season-grain making, so if the season ladder says "far" on most
nights, the ADR sets game-grain bands with their rationale.

## Arguments this season

- **Keyonte George, Ace Bailey, Darryn Peterson**, each in `liveSeasons`,
  dark until the loop's GATES PASS line fires, then one flip PR each:
  authored verdict under the voice guide, guard claims written with margin
  (`hero:report`'s CLAIM HEADROOM), the canonical move, dark to live.
- Keyonte and Ace flip onto an existing 2025-26 argument, so each gains the
  growth coda and may carry a growth-sentence (ADR-0061). Peterson is born
  live and needs a banner photograph with a credit, a human task to start
  early.
- Living verdicts can go red on a morning when a claim drifts. Expect
  rewrites, and write claims with headroom.
- Every other argument is frozen, Cody's included. They still ride the
  four hero contracts, so a future change to those contracts re-exports all
  of them; the new Jazz contracts never touch them.

## Sequence

Opening night is the week of October 19. **The only thing that must be live
by then is the team session pulling every Jazz game's pbp/box pair from game
one.** Raw is append-only and every file rebuilds from it, so any page that
slips can be backfilled over games already played.

### Phase 0: Sloan week (through October 1)

No build work. The abstract is due October 1. Human chores only: create the
backup bucket, set the wake timer.

### Phase 1: integration and operations (October 2 to 7)

- Branch integration, steps 1 through 8.
- Operations: the loop clone, pull-first, branch guard, game-night
  trigger, raw backup, `liveSeasons` entries.
- ADR-0086 renumbered.

### Phase 2: the report card on 2025-26 (October 5 to 18)

- The three-variant prototype of the report card, choose, delete.
- The ruler measurement and the game-grain delta distribution.
- ADR-0088 and ADR-0089; the game payload export, golden, oracles, guards.
- 82 opponent pulls for 2025-26; the season index; 82 game payloads.
- The report card page, the season page with ledger and quadrant, share
  cards and emitted pages.
- ADR-0087: the root becomes the Jazz home, `/arguments` the directory.
- Deploy with 2025-26 as the canonical team season. The site has 82 real
  report cards before the season starts.

### Opening night (week of October 19)

- Config PR: `liveTeams` UTA 2026-27 live; the team registry adds 2026-27
  as canonical once its first game payload deploys.
- First game-night run, watched live.

### Phase 3: live season, drill-ins, computed copy (October 19 to November 8)

- ADR-0091 (game-night publishing, share images in the data commit).
- A player's night, a player's season, the roster rail.
- ADR-0090 and the first templates: the two answers, then superlatives.
- Retire `/game` and the game-log contract; the receipt components move to
  the player's night.
- Methodology additions: the tool class, the pre-game ruler, computed copy,
  freshness. Structural copy, verified against the code.

### Phase 4: league context and feeding (November 9 to December 6)

- Spike: confirm a date-windowed team-wide pull per team, and whether one
  league-wide pull (team ID and player ID both zero) serves a single date.
- ADR-0092: nightly league pulls, the team-game tallies contract, ranks and
  percentiles on the cards ("better than N% of NBA team-games this season").
- Feeding (ADR-0083) into the roster rail and player pages.
- The Sloan manuscript is due December 4 if the abstract is invited. If so,
  feeding slips first.

### Flips (whenever each player's gates pass)

One PR each, interrupting whatever phase is running, in whatever order the
gates pass. Nobody can schedule these, so the phases above leave slack.

### Phase 5: consolidation (December 7 into January)

- ADR-0093: retire the file derive engine. Confirm the record-store tests
  run (not skip) in CI first, adding a Postgres service container if they
  skip; move `golden:regen` to the record-store path; drop `--engine files`
  from the loop and the replay; point `hero:add` at load and export; keep
  the grammar modules the loaders import.
- Rewrite the not-to-do list and CLAUDE.md commands.
- Decide on a read API with the season's real traffic in hand.
- The Stars spike. Revisit the foul record.

## Test plan

### Python

- Game payload export equals its golden through the record-store path.
- Every export oracle fails on a manufactured violation: a shooter's row
  count, a free-throw line, the receipt identity, an assist total, the Jazz
  slice, the ruler.
- A published game file is never rewritten by the loop; a changed row
  halts.
- The branch guard halts off main and on a dirty tree.
- The team replay over 2025-26 dates reproduces the committed game payloads.

### TypeScript

- The game payload golden strict-parses; unknown keys fail.
- Card values equal ledger and quadrant values for every game, as displayed.
- The season index's game set equals the game files present and the team
  shot payload's game set.
- Team route parsing: seasons, game slugs, player slugs, collisions, the
  plain "no such game" note.
- Every hero URL that resolves on main today still resolves.
- Computed copy: predicate and emission agree for every template over every
  deployed game; punctuation rules; no grade or causal vocabulary.
- Component tests under jsdom with explicit cleanup for each new page.
- Deployed-pair guards: every game payload against the team shot payload
  and the index, skipping on clean clones.

### Gates

```text
python -m pytest ingestion -q
npm test
npm run lint
npm run build
```

## Acceptance criteria

The morning after a Jazz game, and ideally that night, a reader can open
one link and answer:

- Did the Jazz take good shots, by how much, against what ruler?
- Did the shots fall?
- What did the opponent take, on the same terms?
- How did each Jazz player's night break down, down to his box total?
- Where does this game sit in the season?

And the operator can say, without opening a terminal, that the night
published or why it did not (the halt toast and the status files).

## Open questions

- **The fallback bar's value.** Settled by the phase 2 measurement.
- **Game-grain ladder bands.** Settled by the phase 2 distribution.
- **Preseason as a dry run.** The pull functions hard-code the regular
  season (`SEASON_TYPE` in `live_pulls.py`). Worth parameterizing only if it
  is an hour's work; the 2025-26 replay is the real rehearsal.
- **Opponent shots before phase 4.** Confirm the date-windowed opponent pull
  returns the opponent's full game (it is the same endpoint and filters the
  team branch already proved, with a date window added).
- **SLC Stars.** Unverified what the G League endpoints carry. Expect shot
  charts and play-by-play at best, no tracking. A December spike decides.
- **The read API.** A résumé item, not a product need, until a page asks a
  question the published files cannot answer.
