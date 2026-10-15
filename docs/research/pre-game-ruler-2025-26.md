# The pre-game ruler, measured on the 2025-26 Jazz

_2026-09-26, Phase 2 of `docs/plans/jazz-first-site.md`. Evidence for
ADR-0089 (the pre-game ruler) and ADR-0090 (computed copy). Every number
below came from the product's own `aggregateShotMetrics` over the deployed
team shot payload (`public/data/_teams/uta/2025-26.json`, 82 games, 7,468
shots) and 83 ruler pulls (`ingestion/pull_rulers.py`)._

## How a ruler is pulled

A game is priced against the league's `LeagueAverages` frame through the day
before it. Three probes settled how to pull it:

- **The frame does not depend on the pull's subject.** Team-wide pulls for
  UTA and OKC through 2025-11-10 returned identical frames (27,771 league
  FGA). A ruler is therefore pulled through a near-shotless player, and each
  verbatim artifact is about 3 KB instead of a team's whole season.
- **The frame respects `DateFrom`.** A one-day window (2025-11-10) returned
  that day's frame only (1,635 league FGA). A ruler is `DateTo`-only, never
  windowed.
- **A one-day team pull returns that team's game exactly.** Minnesota,
  2025-11-10 (game 0022500205): 89 rows, equal to the box score's 89 FGA,
  and every shooter's rows equal his box FGA. This is how a report card gets
  the opponent's shots before phase 4's league pulls exist.

The season-end ruler (through 2026-04-12), rolled up by
`team_payload.rollup_baseline`, equals the deployed team payload's
`zoneBaseline` exactly.

## Question 1: does an early, thin ruler move a card?

Each game's selection and making deltas, under its pre-game ruler and under
the season-end ruler:

| Games | Smallest evaluation zone in the ruler (league FGA) | Max selection move | Max making move |
| --- | --- | --- | --- |
| 1-3 | 20 | 0.015 | 0.011 |
| 4-7 | 453 | 0.002 | 0.009 |
| 8-15 | 914 | 0.002 | 0.009 |
| 16-30 | 2,125 | 0.004 | 0.008 |
| 31-82 | 4,138 | 0.004 | 0.006 |

The worst case is the Jazz's first game (2025-10-22). Its ruler held the
league's opening night only: 2 games, 356 attempts, 20 in the thinnest zone.
Even there, selection moved 0.015 and making 0.011, both inside the verdict
ladder's 0.02 neutral band. From the fourth game on, nothing moves more than
0.009.

**Reading:** the prior-season fallback the plan proposed for thin early
rulers is not needed for accuracy. The one case that still needs it is a
ruler with no games at all: a team playing on the league's opening night has
nothing to be priced against from its own season.

## Question 2: how do game-grain deltas spread on the verdict ladder?

Per game, pre-game ruler, all 82 games (78 to 111 FGA each, so every game
clears the 50-attempt making bar):

| Axis | Min | p10 | Median | p90 | Max |
| --- | --- | --- | --- | --- | --- |
| Selection | -0.083 | -0.054 | -0.018 | +0.032 | +0.070 |
| Making | -0.295 | -0.157 | +0.012 | +0.159 | +0.248 |

Games per ladder band (by the magnitude of the delta):

| Axis and bands | Neutral | Hedged | Bare | Well | Far |
| --- | --- | --- | --- | --- | --- |
| Selection, season ladder (.02/.05/.10/.15) | 30 | 37 | 15 | 0 | 0 |
| Making, season ladder | 10 | 11 | 21 | 21 | 19 |
| Making, 1.5x (.03/.075/.15/.225) | 14 | 19 | 30 | 8 | 11 |
| Making, 2x (.04/.10/.20/.30) | 18 | 24 | 28 | 12 | 0 |
| Making, 2.5x (.05/.125/.25/.375) | 21 | 31 | 27 | 3 | 0 |

**Reading:** the season ladder fits selection at game grain unchanged: a
game's diet is its choices, priced, and those land in three bands with no
"well" or "far". Making does not fit: 40 of 82 games would read "well" or
"far", so the words would stop meaning anything. At twice the season ladder,
making spreads the way selection does, and "far" is reserved for nights that
never happened in 2025-26.

## Also seen

Signs of the two deltas per game (selection first):

| | Making at or above expected | Making below expected |
| --- | --- | --- |
| Diet at or above the league's | 8 | 17 |
| Diet below the league's | 36 | 21 |

The 2025-26 Jazz took a below-league diet in 57 of 82 games. The season
quadrant chart would show that cluster at a glance.
