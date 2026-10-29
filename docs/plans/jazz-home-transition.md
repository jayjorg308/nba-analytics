# Jazz Home Transition Plan

_Decided 2026-10-28 in a grilling session. Refines the Jazz-first site plan
(`docs/plans/jazz-first-site.md`) for its remaining page work: the report
card's restyle, player pages, and the Jazz home at the root (ADR-0087).
Where the two plans disagree, this one wins; everything the Jazz-first plan
decided and this one does not mention still stands._

## Outcome

Good Shots opens on the Utah Jazz's 2026-27 season. The root is the Jazz
home: a poster banner, the latest game featured with the previous three
beside it, the three players the season is about (Keyonte George, Ace
Bailey, Darryn Peterson) over a rail of everyone else, and the season's
evidence below. Every game page and every player page carries the poster
banner the hero arguments made the site's signature. The directory of
arguments moves to `/arguments`, and every hero URL keeps working.

## Where things stand (2026-10-28)

- **Nothing from 2026-27 is published.** `liveTeams` UTA is `dark` in
  `season.config.json`, and the team registry lists only 2025-26. Four games
  are exported locally and wait for the flip: 2026-10-21 at MEM (L 103–123),
  10-23 vs NOP (W 120–119), 10-25 LAL (L 123–132), 10-26 MEM (L 105–110),
  each priced against its own pre-game ruler (3, 16, 36, and 43 games).
- **The loop's halts are fixed on main, not yet in the loop clone.** PR #72
  (the mislabeled technical, player renames, a frontier the store has
  passed) merged today; the clone is at #71 and picks it up through its
  pull-first at the next session (23:45 tonight).
- **The report card renders an error for a season the registry does not
  list** (`ReportCardPage`: `team.seasons.includes(route.season)`), while
  the build emits share pages for every committed season index. So 2026-27
  card URLs work only once the registry lists the season.
- **Headshots exist for the eleven heroes only.** Darryn Peterson has
  neither a headshot nor a banner photo.
- **Per-player game lines live only in the ledger file and the game
  files.** The ledger omits a player's night with free throws but no field
  goal (`fga` min 1), and the game files are too heavy to fetch a season of.

## Decisions

1. **One page for the home and the season.** `/` and `/jazz` render the
   Jazz home for the canonical team season; `/jazz/<season>` renders an
   archived season in the same layout. The season's header image is the
   home's banner. (The hero pattern: an alias renders its current season in
   place, never a link to it.)
2. **Live first.** The 2026-27 surface goes live before any design work
   (Stage 0). Pages are code, so every restyle applies to every published
   game the day it ships.
3. **Game banner: an optional photo over a typographic poster.** Every game
   page gets the poster banner. A game publishes at 23:45 with a
   typographic poster (the score at poster scale, the night's title, the
   team mark); a photo from that game, added later by PR, replaces it. A
   photo from another game is never used, because its alt text would
   describe a different night.
4. **A photo PR redraws that game's share card** with the photo behind it.
   The loop still never redraws a card; a photo PR redraws exactly one, as a
   human step. Amends ADR-0091.
5. **A game photo is credited on its own card**: a small line under the
   banner and in a corner of its share card, in the two house forms
   ("photograph by <Name>, <Org>" / "photograph via the Utah Jazz"). The
   methodology page's SOURCES gains one sentence saying game photographs are
   credited on their cards; `docs/image-credits.md` keeps the provenance.
6. **On a portrait phone, a photo banner is the landing screen** (the full
   first viewport, exactly as ADR-0025's hero poster); a typographic banner
   is content height, so the quadrant and answers follow directly.
7. **The home banner is one authored photo per season**, set and swapped by
   PR, credited in SOURCES like a hero banner, its alt text under the voice
   guide's banner rules. A season without one (2025-26 today) falls back to
   the typographic poster.
8. **The home banner is name-led.** Kicker: the season and its frontier
   ("2026-27 · through Oct 26 · 4 games"); h1: "Utah Jazz"; cue: "↓ The
   latest game". Structural copy, true every day. No question the page does
   not answer in words.
9. **The featured latest game is photo-led**: the game's photo as the
   tile's ground with the score and title over it and the two answers beside,
   the typographic treatment until its photo lands. The previous three games
   follow as compact tiles (date, opponent, result, the two numbers with
   their answer words), one row on desktop, stacked on phones.
10. **Every Jazz shooter gets a player page**, rostered or departed: one
    component, one mechanical rule, so every name in a report card's PLAYERS
    table links. The featured three are featured by the home's spotlight,
    not by having the only pages.
11. **A featured player's tool page and argument link each other.** The
    home's spotlight links `/jazz/<slug>`; that page links his argument (his
    2025-26 one now, the 2026-27 one after his flip); the argument gains a
    "Game by game" link back. Arguments stay answer-then-evidence.
12. **A player page's banner is the headshot banner**, uniform for every
    player: kicker (team · number · season), the name as h1, his season
    count, and his standard headshot cutout on the dark ground. Action photos
    stay on the arguments they were chosen for (ADR-0065's line). A player
    without a committed headshot renders the banner without art, never a
    placeholder.
13. **The player season page ships now; the player's night later.** The
    season page carries his quadrant (one dot per game, each priced against
    that game's own ruler), his season zones against the league with
    ADR-0075's local flags, and a game table whose rows link the team report
    card until the player's-night page exists. The season index gains every
    player's box line per game so the table reads one small file.
14. **The home's players: three cards and a rail.** Keyonte, Ace, and
    Peterson as larger headshot cards (his priced attempts and the two
    season-to-date numbers with local flags, one structural status line for
    his argument, a link to his page); every other Jazz shooter in a
    name-only rail below, departed players under their own caption. The
    directory's marquee-and-rail grammar at team grain.
15. **The directory moves to `/arguments`**, as ADR-0087 was planned: the
    same marquee and rail, Jazz arguments first; the shared footer gains an
    Arguments link; the home closes with an Arguments section. Every hero URL
    is permanent; every argument but the three living ones is frozen.
16. **The game page's body is chosen by a prototype**: two or three variants
    under the new banner, on real 2026-27 games at desktop and 375px,
    chosen, recorded in NOTES, deleted before the real build. Candidates: the
    banner over today's layout; plus numbered act kickers and the answers
    styled as the hero headline cards; plus the split visual and data layout
    for the court and the both-sides table. _Chosen 2026-10-29: C (every act
    a visual and its data twin, both teams' courts) without its per-player
    expected-versus-scored chart, which repeated the players table. Built on
    the 2025-26 Apr 10 game, since 2026-27 waited on the registry PR; the
    verdict and the declined variants are in ADR-0094._
17. **Stage order: 0 → 1 → 2 → 3**, below. Player pages come before the home
    because the home's cards and rail link them.
18. **Player pages have season permalinks.** `/jazz/<slug>` is the canonical
    alias (the current season, rendered in place) and
    `/jazz/<season>/<slug>` the stable per-season page, ADR-0060's pattern at
    team grain. Every report card links its own season's player pages, so
    2025-26 comes along almost free.

### Defaults taken

Engineering calls made during the session rather than put to a vote; any
can be reopened.

- **The featured list is explicit**, per season in the team registry, and a
  guard holds it equal to the hero seasons `season.config.json` lists for
  that season, so featuring and the living arguments can never disagree.
- **Player slugs come from the name**: lowercased, diacritics folded,
  punctuation dropped (`terrence-shannon-jr` survives the "Jr." to "Jr"
  rename seen 2026-10-27), unique per season under a guard.
- **Photo config is authored config, never payload.** A `src/teams/` module
  keyed by game slug (the date makes it unique across seasons) carrying the
  image path, alt text, credit, and both focal points: a hero banner's
  shape. The game payload stays immutable data (ADR-0088).
- **A `game:photo` helper** takes a source image and a game slug, writes the
  web-sized derivative, stubs the config entry with `TODO(scaffold)`
  sentinels (the authoring tripwire holds the PR red until the alt text,
  credit, and focal points are written), and redraws that game's share card.
- **No photo backfill for 2025-26.** Its 82 cards keep the typographic
  poster.

## Stages

Each stage ships on its own, by PR, with the full gate (pytest with Docker
running and the count checked, `npm test`, `npm run lint`, `npm run build`).
ADR numbers are assigned when written: 0087 is reserved for the home, and
0092 and 0093 stay reserved by the Jazz-first plan for its phases 4 and 5,
so new decisions here start at 0094.

### Stage 0: go live

- Config PR: `liveTeams` UTA 2026-27 to `live`. The next team session
  publishes every game through its frontier with its share card, in one data
  commit. _Built 2026-10-28 on `task_JazzLive`, with a local rehearsal of
  that session's publish, reverted afterward: the 10:29 dry-run export
  (four games through 10-26) synced by `team:sync`, its four cards drawn by
  `cards:games -- --missing`, and the full gate green over it (pytest 224
  with the record-store tests required, vitest 800 with the 2026-27 guard
  cases running, lint, build)._
- Confirm the loop clone has pulled #72 before that session (its
  pull-first does it; check the run log's commit).
- Registry PR, the morning after the first data commit, never before it:
  `utahJazz.seasons` gains `2026-27` and `canonicalSeason` moves to it, and
  the README's `/jazz` line follows. Landing it first would turn the loop's
  gate red (every registered season must have a published index) and halt
  the publish. Until it lands, 2026-27 card URLs render the
  season-not-on-file note and the build emits no share pages for them;
  nothing links them yet, so the gap is invisible. _Rehearsed the same day
  over the synced files: two tests read the live registry's canonical season
  and failed on the move, so this PR pins them to a fixed 2025-26 config;
  with that, the registry change alone is green (vitest 800, build emitting
  86 report card pages), and `/jazz` and `/jazz/2026-10-23-nop` rendered the
  2026-27 season with the 2025-26 games behind the quadrant._ _Landed
  2026-10-29 on `task_JazzRegistry`, after the first data commit
  (`b45c655`, the night of 10-28: five games through 10-28, cards included)._
- Done when `/jazz` renders 2026-27 and each published game's card and share
  page resolve.

### Stage 1: the banner and the game page

- **One poster banner component**, extracted from `HeroPage`'s banner, in
  three forms: photo (hero, game, season), typographic (no art, the team
  mark in the wide layout's left column), and headshot (player). Hero pages
  move onto it with no visual change.
- **Game imagery**: the photo config module, the `game:photo` helper, the
  authoring tripwire over game photo entries (no sentinel, every image on
  disk), the credit line under the banner, and the card generator drawing
  the photo and its credit when a game has one.
- **The prototype** (decision 16) on the published 2026-27 games, then the
  chosen restyle of `ReportCardPage`.
- **Phone behavior** per decision 6.
- **Docs**: an ADR for banners on tool pages and authored game imagery
  (amending ADR-0081's no-banner stance for the team surface, and ADR-0091
  for the one-card redraw); the methodology SOURCES sentence; CONTEXT's team
  report card entry. Structural copy verified against the code.
- Done when a game page renders both banner forms correctly at desktop and
  375px, and a test photo PR (on a branch, not merged) shows the tripwire
  red until authored and the redrawn card.
- _Built 2026-10-29 on `feature_GameDetailUpdate` (ADR-0094). The headshot
  form waits for Stage 2's player pages, which are its only reader. The
  typographic form puts the team mark where the photo would sit rather than
  in the left column. The photo flow was rehearsed on the 2025-26 Apr 10
  game with a stand-in image and reverted: `game:photo` stubbed the entry,
  the guard went red on four sentinels and the generator refused the stub,
  then the authored entry drew the photo card, the guard went green, and
  the page showed the photo and its credit. Redrawing photo-less cards
  produced byte-identical files._

### Stage 2: player pages

- **Season index, schema v2** (an ADR-0088 amendment): each game row gains
  every appearing player's box line. Export, Zod contract, golden
  (`regen_game_golden.py`), and a deployed guard that each row's lines equal
  its game file's. Both seasons' indexes re-exported; the index is living,
  never one of the immutable game files.
- **Routes**: `/jazz/<slug>` and `/jazz/<season>/<slug>` in `teamRoute.ts`
  (a player slug starts with a letter, so no pattern collides), the slug
  rule and its uniqueness guard, the reserved third segment for the later
  player's night.
- **The page** (decision 13) under the headshot banner, a tool page with
  ADR-0075's local flags.
- **Headshots**: a script fetching the standard NBA headshot for every Jazz
  shooter without one (Peterson's included), committed by PR.
- **Links**: report card PLAYERS names to their season's player pages; the
  "Game by game" link on Jazz hero arguments (a second structural link on a
  frozen argument, recorded beside ADR-0060's forward link).
- **Docs**: an ADR for player season pages (tool class, permalinks, slug
  rule); CONTEXT entries; methodology structural copy.
- Done when every Jazz shooter of both seasons has a page that resolves, and
  every report card's player names link.
- _Built 2026-10-29 on `feature_PlayerPages` (ADR-0095, ADR-0088 as
  amended). 30 players have pages across the two seasons; 27 headshots
  fetched (5 MB), every one a real photograph. The index re-export left all
  82 2025-26 game files unchanged and matched the five 2026-27 files. The
  deployed guard holds every player's game numbers equal to his report card
  line in both seasons, and Cody Williams's 2025-26 page counts the same
  509 shots as his argument's payload. Decided in the build: his prior
  season's games sit faded behind his quadrant (an open detail above), the
  cue reads "↓ The season", and on a portrait phone the headshot banner
  grows to 380px so the headshot stands above the name, never under it.
  Player pages have no emitted share page yet; that joins Stage 3's share
  work._

### Stage 3: the Jazz home

- A two-variant prototype of the home first, since it is the front door.
  _Chosen 2026-10-29: A, Acts (one column of numbered acts in the report
  card's recipe; the latest game as a full-width tile with the score at
  poster scale and the two answers beside it, the three before it as a row
  of tiles; the featured three as portrait headshot cards, a swipe rail on
  phones; the arguments closing as the directory's headshot rail). Declined:
  B, Front page (the latest game and the players side by side in two
  columns, a scoreboard strip, landscape player rows, a typographic argument
  list), which fit more above the fold on desktop but broke the
  single-column rhythm every other page keeps and collapsed to the same
  stack on a phone. Built on the five published 2026-27 games; the
  prototype was deleted before the build. The root's share card is a static
  Jazz season card in the directory card's grammar (the team mark where a
  headshot sits), chosen over the latest game's card, whose cached previews
  would go stale._
- **ADR-0087**: `/` renders the Jazz home, `/jazz` its alias, `/arguments`
  the directory (Jazz arguments first by registry order), the footer's
  Arguments link, the root's share card and emitted page. Amends ADR-0022
  and ADR-0065.
- **The page, top to bottom**: the season banner (decisions 7 and 8); the
  featured latest game and the previous three (decision 9); the featured
  three and the rail (decision 14); THE SEASON SO FAR quadrant; ZONE BY
  ZONE; the GAME LEDGER read from the season index; ARGUMENTS.
- **Team config**: the per-season banner photo, its credit, and the
  featured list.
- **Retire the ledger file** once nothing reads it (the Jazz-first plan's
  intent).
- **Docs**: README (intro, "Live at", the route list), methodology, CONTEXT
  (Hero index, Team surface, Site footer), structural copy verified against
  the code and the deployed files.
- Done when the root opens on the Jazz, `/arguments` lists every argument,
  and every hero URL that resolves on main today still resolves.
- _Built 2026-10-29 on `feature_JazzHome` (ADR-0087). `TeamPage` became
  the home for `/`, `/jazz`, and `/jazz/<season>`, over a new pure module
  (`teamHome.ts`); the team registry gained `homes` per season (the
  featured list and an optional banner photograph). Decided in the build:
  the featured list is the season's arguments living AND frozen (the
  default named only the living), so 2025-26 features Cody Williams,
  Keyonte George, and Ace Bailey; the status line reads "2026-27 argument
  published" or "No 2026-27 argument yet"; a featured player with no shot
  keeps a named, unlinked "No shots yet" card; the season's pair moved
  into 04 · THE FLOOR beside ZONE BY ZONE; the footer's "All players"
  became "Arguments" to `/arguments`, with a four-tile glyph. The root's
  card is a static season card (the team mark where a headshot stands),
  and the root's emitted page has no og:url because it is every
  unemitted route's fallback. The ledger file retired from the deployment
  (`aggregateTeam` reads the index; `team:sync` skips it); its producer
  retires in a follow-up PR. Player pages still have no emitted share
  page: they fall back to the root's, now the Jazz season card. Checked:
  all 22 hero URLs, `/methodology`, `/compare`, `/game`, every team route
  kind, and the home at 1280px and 375px._

### Later

- The player's night, `/jazz/<game-slug>/<player-slug>`: the poster and
  receipt from the retired game cards over the player's slice of the game
  payload; then `/game` and the game-log contract retire.
- The Jazz-first plan's phase 4 (league context, feeding) and phase 5 (one
  derive engine) are unchanged.

## Human tasks

- **The 2026-27 season photo**, with its credit and alt text, before Stage 3
  ships.
- **Game photos** whenever you want them, from Stage 1 on, through
  `game:photo`.
- **Darryn Peterson's banner photo** before his flip (his headshot comes
  from the Stage 2 script). _Chosen 2026-10-29 and committed at
  `public/img/darryn-peterson-hero.jpg`, the path `hero:scaffold` emits
  (provenance in `docs/image-credits.md`). For the flip PR: credit
  "photograph by Aaron Baker, Imagn Images"; alt text drafted for the
  author's red pen, the frame only with no opponent in it, "Darryn
  Peterson pushes the ball up the floor in the white Jazz number 22
  jersey"; focal points set by eye in the browser at the flip. A
  shooting frame would argue the thesis better and may replace it._
- Review each prototype; red-pen the structural copy each stage adds.

## Open details for the builds

Small enough to settle inside their stage, recorded so they are not lost.

- The banner cue's words on game and player pages ("↓ The verdict" is an
  argument's cue).
- Whether a player's quadrant shows his prior season's games faded behind,
  as the team quadrant does.
- The featured card for a player with no shots yet (an injury, a late
  return): a structural "no shots yet" line, never a hidden card. _Settled
  in Stage 3: "No shots yet", the card named and unlinked._
- The status line's words for a featured player whose argument has not
  flipped (Peterson until his gates pass). _Settled in Stage 3: "No
  2026-27 argument yet", flipping by itself to "2026-27 argument
  published" when the flip PR registers the season._
