// The team surface's STRUCTURAL copy (ADR-0081): every sentence the /jazz
// pages render that is not a number or a name. Structural, never a claim —
// no verdict, no grade, no whole-team reading — which is exactly why it is
// gathered here and guarded (src/teams/teamCopy.test.ts): nothing else
// fails when a tool's copy drifts into an argument.
//
// Team-agnostic on purpose: the team's name and season arrive as arguments.

export const TEAM_COPY = {
  /** The h1: names the surface as a tool. */
  title: (team: string) => `${team} shot profile`,
  kicker: (team: string, season: string) => `${team} · ${season}`,
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
