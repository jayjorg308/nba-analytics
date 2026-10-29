// The team surface's STRUCTURAL copy (ADR-0081): every sentence the /jazz
// pages render that is not a number or a name. Structural, never a claim —
// no verdict, no grade, no whole-team reading — which is exactly why it is
// gathered here and guarded (src/teams/teamCopy.test.ts): nothing else
// fails when a tool's copy drifts into an argument.
//
// Team-agnostic on purpose: the team's name and season arrive as arguments.

export const TEAM_COPY = {
  /** The one line of self-explanation, closing with the methodology cue. */
  toolNote:
    'A tool, not an argument. Counts and flags, with no judgment on top. Every number here is the same arithmetic the player pages use, over the team’s shots.',
  toolNoteCue: 'How to read it',
  profileCaption: 'ZONE BY ZONE',
  profileDesc: 'the team’s shot diet and shot making, vs league average (making Δ in FG percentage points)',
  ledgerCaption: 'GAME LEDGER',
  ledgerDesc:
    'one row per game, newest first. Box facts, plus the headline pair over that game’s shots.',
  ledgerThinNote:
    '† fewer than 50 attempts in the game. The pair still renders, with its count, and reads as noise, not as a result.',
  seasonsLabel: 'Seasons',
} as const

const COUNT_WORDS = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX']

/** The team home's STRUCTURAL copy (ADR-0087; the site root, `/jazz`, and
 * `/jazz/<season>`): the season banner, the acts' kickers and captions, the
 * game tiles' labels, and the featured cards' lines. The tool class, so no
 * verdict and no reading of the numbers: the only directional words on the
 * page are the report card's computed copy (./computedCopy.ts), repeated on
 * the game tiles exactly as each card shows them. Each sentence was checked
 * against src/domain/teamHome.ts; the qualifiers are load-bearing. */
export const HOME_COPY = {
  /** Decision 8: the season and its frontier, true every day. */
  kicker: (season: string, through: string, games: number) =>
    `${season} · through ${through} · ${games} game${games === 1 ? '' : 's'}`,
  cue: '↓ The latest game',
  actLatest: '01 · THE LATEST GAME',
  // Load-bearing: "in brief". The tile repeats the card's score, title,
  // and two answers (seasonDots, the card's own numbers), nothing more.
  latestDesc: (previous: number) =>
    previous === 0 ? 'the newest report card in brief' : 'the newest report card in brief, then the games before it',
  latestCue: 'The card →',
  previousLabel: (n: number) => (n === 1 ? 'The game before' : `The ${['', 'one', 'two', 'three'][n] ?? n} before`),
  pricedShots: (n: number) => `${n} priced shots`,
  actPlayers: '02 · THE PLAYERS',
  playersTitle: (n: number) => (COUNT_WORDS[n] ? `THE ${COUNT_WORDS[n]}` : 'THE PLAYERS'),
  // Load-bearing: "to date" and "priced". A card's numbers are his season
  // page's (buildPlayerSeason against the season's frontier ruler), over
  // evaluation-zone attempts only.
  playersDesc:
    'the players this season is about, each with his priced shots to date against the league average',
  cardMeta: (number: string | null, games: number, priced: number) =>
    `${number === null ? '' : `Nº ${number} · `}${games} game${games === 1 ? '' : 's'} · ${priced} priced shots`,
  cardDiet: 'shot diet vs the league’s',
  cardConversion: 'conversion vs expected',
  // Load-bearing: SMALL_SAMPLE_MAKING_ATTEMPTS (constants.ts) is the bar.
  cardFlagNote: (bar: number) => `† conversion on fewer than ${bar} priced shots: treat as uncertain`,
  noShotsYet: 'No shots yet',
  // The argument's one status line (an open detail of the plan, settled in
  // ADR-0087). Load-bearing: "yet". The card belongs to a living argument
  // (the featured guard holds every card to one), so the season's argument
  // is pending, never declined; the line flips by itself when the flip PR
  // registers the season argument.
  statusPublished: (season: string) => `${season} argument published`,
  statusNotYet: (season: string) => `No ${season} argument yet`,
  railTitle: 'Everyone else',
  railTitleAll: 'Every player',
  // Load-bearing: "as last pulled". The roster is a current-state snapshot
  // (CONTEXT.md, Roster snapshot), so the caption shows on the canonical,
  // living season only.
  railDeparted: 'Not on the roster as last pulled',
  actGames: '03 · THE GAMES',
  quadrantDesc:
    'every game so far, its shot diet against the league’s across and its conversion against expected up, each priced against the league as it stood that day',
  legendLatest: 'the latest game',
  actFloor: '04 · THE FLOOR',
  actLedger: '05 · THE LEDGER',
  actArguments: '06 · THE ARGUMENTS',
  argumentsTitle: 'ARGUMENTS',
  // Load-bearing: "Jazz players first". The section reads directoryOrder,
  // which puts every hero with a season argument naming this team's page
  // first, each group in registry order.
  argumentsDesc: (team: string) =>
    `every player argument on file, ${team} players first, each a complete page about one season`,
  allArguments: 'All arguments →',
  // The season card and the emitted share pages (ADR-0087). Load-bearing:
  // "every shooter's season". A player with free throws but no shot has no
  // season page (ADR-0095).
  cardCue: 'The latest game →',
  shareDescription: (team: string, season: string) =>
    `${team} ${season}, game by game. Every game’s report card and every shooter’s season, each game priced against the league as it stood that day.`,
} as const

/** The team report card's STRUCTURAL copy (docs/plans/jazz-first-site.md):
 * labels, captions, notes, and the ruler line. Every directional word on
 * the card (the answers, the night's title, the corner labels, the rank
 * phrasing) is computed copy and lives in ./computedCopy.ts, never here.
 * Each sentence below was checked against the code it describes: the
 * qualifiers ("priced", "the same ruler", "so far") are load-bearing. */
export const REPORT_COPY = {
  kicker: (team: string, date: string, matchup: string) => `${team} · ${date} · ${matchup}`,
  /** The poster's scroll cue: what the scroll reaches, never a claim. */
  cue: '↓ The card',
  /** A game photo with no known credit (ADR-0071's banner rule). */
  creditPending: 'photograph credit pending',
  backToSeason: (season: string) => `${season} season`,
  // The acts' numbered kickers (ADR-0094, the hero page's ADR-0051 recipe):
  // dimension words naming each act's cut of the game, never rhetoric. Flat
  // strings, so the copy guard reads every one.
  actNight: '01 · THE NIGHT',
  actFloors: '02 · THE FLOORS',
  actTerms: '03 · THE TERMS',
  actPlayers: '04 · THE PLAYERS',
  // Load-bearing: "so far" — the card's quadrant and ranks stop at tonight
  // (reportCard.ts filters later games out), so a shared card never moves.
  quadrantCaption: 'THE SEASON SO FAR',
  quadrantDesc:
    'every game through this one, its shot diet against the league’s across and its conversion against expected up, each priced against the league as it stood that day',
  xAxis: 'shot diet vs the league’s (PPS) →',
  yAxis: '↑ conversion vs expected (PPS)',
  legendTonight: 'this game',
  legendSeason: (season: string) => `${season} games so far`,
  legendPrior: (season: string) => `${season} games`,
  hintPointer: 'Hover a game to read it. Click to open its card.',
  hintTouch: 'Tap a game to open its card.',
  dotLabel: (date: string, matchup: string, result: string, diet: string, conversion: string) =>
    `${date} ${matchup}, ${result}. Diet ${diet}, conversion ${conversion}.`,
  dietAnchor: 'their diet at league rates',
  leagueDietAnchor: 'the league’s diet',
  scoredAnchor: 'scored per shot',
  expectedAnchor: 'expected from their diet',
  pricedShots: (n: number) => `${n} priced shots`,
  // Load-bearing: heaves (Backcourt) leave the evaluation and conflicts are
  // dropped from shots[] at export (ADR-0019); neither enters either number.
  unpriced: (heaves: number, conflicts: number) =>
    [
      heaves > 0 ? `${heaves} heave${heaves === 1 ? '' : 's'}` : '',
      conflicts > 0 ? `${conflicts} zone-point conflict${conflicts === 1 ? '' : 's'}` : '',
    ]
      .filter(Boolean)
      .join(' and ') + ' not priced.',
  courtCaption: 'BOTH TEAMS’ SHOTS',
  // Load-bearing: "zone-point conflicts aside". A conflict is dropped from
  // shots[] at export (ADR-0019), so it is on neither court nor in the
  // counts; the answers' unpriced note carries it. Heaves stay in the
  // Backcourt count though the court, like the page's, skips them.
  courtDesc:
    'every attempt by both teams, made and missed, with counts by zone (zone-point conflicts aside). One game is too few shots to shade a zone.',
  sidesCaption: 'BOTH SIDES',
  sidesDesc: 'each team on the same terms, priced against the same ruler',
  sidesNote:
    'The mark shows the higher of the two on diet, scoring per shot, conversion, and free-throw points. Shares carry no mark. The table describes each side’s shots and credits neither defense.',
  rowDiet: 'Shot diet at league rates',
  rowScored: 'Scored per shot',
  rowConversion: 'Conversion vs expected',
  rowRim: 'At the rim, share of shots',
  rowThrees: 'Threes, share of shots',
  rowMid: 'Mid-range, share of shots',
  rowTrips: 'Trips to the line',
  rowFtPoints: 'Free-throw points',
  rowCredit: 'Assisted share of makes',
  playersCaption: 'PLAYERS',
  playersDesc: (team: string) =>
    `each ${team} player with a field-goal or free-throw attempt, highest scorers first`,
  // Load-bearing: expected is the diet-weighted expectation times priced
  // attempts, scored the points on those same attempts (reportCard.ts).
  playersNote:
    'Expected and scored count priced field goals only, each attempt at the ruler’s league rate for its zone. Heaves, zone-point conflicts, and free throws are outside both.',
  // Load-bearing: "through" is inclusive (the ruler's DateTo), and the game
  // count comes from the league game log (ADR-0089).
  rulerPreGame: (through: string, games: string) =>
    `Priced against the league as it stood entering the day, ${games} games through ${through}. Each dot on the chart is priced against its own day’s league.`,
  rulerPriorSeason: (season: string, games: string) =>
    `Priced against the full ${season} season, ${games} games, since no league game had been played before this one. Each dot on the chart is priced against its own day’s league.`,
  draftTag: 'draft copy',
  // The emitted share page's meta (the ADR-0067 pattern at game grain).
  shareDescription: (team: string, date: string, matchup: string) =>
    `${team} report card, ${date} ${matchup}. Shot diet and conversion against the league as it stood that day, both teams on the same terms.`,
  shareImageAlt: (team: string, score: string, date: string, matchup: string) =>
    `${team} report card, ${score} ${matchup}, ${date}, with the game’s shot chart`,
  noSuchGame: (team: string, segment: string) => `No ${team} game on file for ${segment}.`,
  seasonNotOnFile: (team: string, segment: string) => `No ${team} season on file for ${segment}.`,
} as const

/** A player's season page's STRUCTURAL copy (ADR-0095): the tool class, so
 * no verdict, no grade, no reading of the numbers. Each sentence was checked
 * against src/domain/playerSeason.ts; the qualifiers are load-bearing. */
export const PLAYER_COPY = {
  kicker: (team: string, number: string, season: string) =>
    number === '' ? `${team} · ${season}` : `${team} · Nº ${number} · ${season}`,
  cue: '↓ The season',
  // Load-bearing: "this season's roster as last pulled". The roster is a
  // current-state snapshot (CONTEXT.md, Roster snapshot), so the note shows
  // only on the team's canonical, living season.
  departed: (team: string) => `Not on the ${team} roster as last pulled.`,
  argument: (season: string) => `His ${season} argument`,
  priorSeason: (season: string) => `His ${season} season`,
  backToTeam: (team: string, season: string) => `${team} ${season}`,
  actGames: '01 · THE GAMES',
  actSeason: '02 · THE SEASON',
  actLog: '03 · THE LOG',
  // Load-bearing: "a priced shot". The quadrant draws a game only with an
  // evaluation-zone attempt (playerSeason.ts gameDots); a night of free
  // throws or heaves has no diet to place.
  quadrantCaption: 'HIS GAMES',
  quadrantDesc:
    'every game he took a priced shot in, his shot diet against the league’s across and his conversion against expected up, each priced against the league as it stood that day',
  legendLatest: 'his latest game',
  noPricedShot: 'No game with a priced shot yet, so nothing to place on the chart.',
  // Load-bearing: the season's own league average. The season view uses the
  // team payload's frontier ruler, as the team page does (ADR-0089).
  zoneCaption: 'ZONE BY ZONE',
  zoneDesc: (season: string) =>
    `his season’s shot diet and shot making against the ${season} league average (making Δ in FG percentage points)`,
  logCaption: 'GAME LOG',
  logDesc: 'every game he appeared in, newest first: his box line and his priced shots, against the league as it stood that day',
  logNote:
    'Expected and scored count priced field goals only, each attempt at that game’s league rate for its zone. Heaves, zone-point conflicts, and free throws are outside both.',
  notOnFile: (team: string, slug: string, season: string) => `No ${team} player on file for ${slug} in ${season}.`,
} as const
