// A team season's home (ADR-0087; docs/plans/jazz-home-transition.md,
// decisions 1, 9, and 14): the pure module behind `/`, `/jazz`, and
// `/jazz/<season>`. Every number is another module's, assembled here so the
// page only formats: the games are seasonDots (each game's slice under its
// own pre-game ruler, so a tile equals its card), the featured players are
// buildPlayerSeason (so a card equals his season page), and the season view
// and ledger are aggregateTeam (ADR-0011: React never slices or tallies).

import { aggregateTeam } from './aggregateTeam'
import type { TeamMetrics } from './aggregateTeam'
import { buildPlayerSeason, playerSlug, seasonShooters } from './playerSeason'
import type { PlayerSeason } from './playerSeason'
import { seasonDots } from './reportCard'
import type { GameDot } from './reportCard'
import type { TeamSeasonIndex } from './teamSeasonIndex'
import type { TeamShotPayload } from './teamShotPayload'

/** How many games follow the featured latest one (decision 9). */
export const PREVIOUS_GAMES = 3

/** A featured player's card: his season when he has a shot for the team
 * this season, null before his first (the card still renders, named, with
 * no numbers: never a hidden card). */
export interface FeaturedCard {
  slug: string
  playerName: string
  /** His jersey number on the season's roster snapshot, when listed. */
  number: string | null
  season: PlayerSeason | null
}

/** A name in the rail: every other shooter of the season. */
export interface RailPlayer {
  slug: string
  name: string
  /** On the season's roster snapshot as last pulled (a current-state
   * snapshot, so the page reads it on the canonical season only). */
  onRoster: boolean
}

export interface TeamHome {
  metrics: TeamMetrics
  /** Every published game of the season, chronological. */
  dots: GameDot[]
  latest: GameDot
  /** Up to PREVIOUS_GAMES games before the latest, newest first. */
  previous: GameDot[]
  /** The prior season's games, when that season is published. */
  priorDots: GameDot[]
  priorSeason: string | null
  featured: FeaturedCard[]
  /** Every shooter not featured, most shots first (then name). */
  rail: RailPlayer[]
}

export function buildTeamHome(
  featured: readonly { slug: string; playerName: string }[],
  payload: TeamShotPayload,
  index: TeamSeasonIndex,
  prior?: { index: TeamSeasonIndex; payload: TeamShotPayload },
): TeamHome {
  const metrics = aggregateTeam(payload, index)
  const dots = seasonDots(index, payload)
  const latest = dots.at(-1)!
  const rostered = new Map(payload.roster.map((r) => [playerSlug(r.playerName), r]))
  const featuredSlugs = new Set(featured.map((p) => p.slug))
  return {
    metrics,
    dots,
    latest,
    previous: dots.slice(-1 - PREVIOUS_GAMES, -1).reverse(),
    priorDots: prior ? seasonDots(prior.index, prior.payload) : [],
    priorSeason: prior ? prior.index._meta.season : null,
    featured: featured.map((p) => {
      const season = buildPlayerSeason(p.slug, payload, index)
      const entry = rostered.get(p.slug)
      return {
        slug: p.slug,
        playerName: p.playerName,
        number: season !== null ? season.number : entry && entry.number !== '' ? entry.number : null,
        season,
      }
    }),
    rail: seasonShooters(payload)
      .filter((p) => !featuredSlugs.has(p.slug))
      .map((p) => ({ slug: p.slug, name: p.name, onRoster: payload.roster.some((r) => r.playerId === p.playerId) })),
  }
}
