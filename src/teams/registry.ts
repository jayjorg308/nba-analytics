// The team registry (ADR-0081/0082): the single source of team-surface
// truth, the hero registry's shape at team grain. A team surface is a
// TOOL, never an argument — no verdict, no thesis, no banner copy lives
// here; what a team config carries is identity, the seasons with deployed
// team payloads, and which of them the bare /<slug> renders.
//
// Node-safe on purpose (no import.meta), so scripts can import it; URL
// derivation lives in ./urls.ts.

export interface TeamConfig {
  /** The route segment (`/jazz`) — reserved beside methodology and compare. */
  slug: string
  /** The ADR-0028 static-map abbreviation; lower-cased it is the deployment
   * key under public/data/_teams/. */
  tricode: string
  /** stats.nba.com's TEAM_NAME form. */
  name: string
  teamId: number
  /** The normalized team mark (ADR-0021's watermark treatment), path under
   * public/, no leading slash. */
  teamLogoPath?: string
  /** Seasons with deployed team payloads (shot + ledger), oldest first. */
  seasons: readonly string[]
  /** The season the bare /<slug> renders — moved by a config change when a
   * new season's payloads deploy (the team surface's flip), never by the
   * season loop. */
  canonicalSeason: string
}

export const utahJazz: TeamConfig = {
  slug: 'jazz',
  tricode: 'UTA',
  name: 'Utah Jazz',
  teamId: 1610612762,
  teamLogoPath: 'img/utah-logo.png',
  // 2025-26 is the completed season the surface opens on; 2026-27 joins the
  // list the day its first payloads deploy and becomes canonical then.
  seasons: ['2025-26'],
  canonicalSeason: '2025-26',
}

/** Ordered; today one team. */
export const TEAMS: readonly TeamConfig[] = [utahJazz]

export function teamBySlug(slug: string): TeamConfig | undefined {
  return TEAMS.find((t) => t.slug === slug)
}

/** An NBA game id: ten digits. Distinguishes /jazz/<gameId> from
 * /jazz/<season> in the route's second segment. */
export const GAME_ID = /^\d{10}$/
export const SEASON = /^\d{4}-\d{2}$/
