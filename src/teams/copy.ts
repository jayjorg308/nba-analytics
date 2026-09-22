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
  gameZonesCaption: 'ZONE COUNTS',
  gameZonesDesc: 'attempts and makes per zone in this game. Counts only, no league comparison.',
  gamePlayersCaption: 'WHO SHOT',
  gamePlayersDesc: 'everyone who attempted a field goal, highest scorers first',
  gameNote:
    'One game is the thinnest sample the site shows. Zones carry no shading here because no zone reaches fifteen attempts in a game.',
  seasonsLabel: 'Seasons',
  backToTeam: (team: string) => `${team} season`,
} as const
