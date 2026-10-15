// App-layer URL derivation for the team surface (ADR-0081/0082) — the one
// place the team registry meets import.meta.env, mirroring src/heroes/urls.ts.

import type { TeamConfig } from './registry'

function key(team: TeamConfig): string {
  return team.tricode.toLowerCase()
}

export function teamShotPayloadUrl(team: TeamConfig, season: string): string {
  return `${import.meta.env.BASE_URL}data/_teams/${key(team)}/${season}.json`
}

export function ledgerFactsUrl(team: TeamConfig, season: string): string {
  return `${import.meta.env.BASE_URL}data/_teams/${key(team)}/${season}.ledger.json`
}

/** The bare team route: renders the canonical season in place. */
export function teamPageUrl(team: TeamConfig): string {
  return `${import.meta.env.BASE_URL}${team.slug}`
}

export function teamSeasonUrl(team: TeamConfig, season: string): string {
  return `${import.meta.env.BASE_URL}${team.slug}/${season}`
}

/** The season index (ADR-0088): one row per published game, with rulers. */
export function teamSeasonIndexUrl(team: TeamConfig, season: string): string {
  return `${import.meta.env.BASE_URL}data/_teams/${key(team)}/${season}/index.json`
}

/** One game payload (ADR-0088), keyed by game id like every payload file. */
export function gamePayloadUrl(team: TeamConfig, season: string, gameId: string): string {
  return `${import.meta.env.BASE_URL}data/_teams/${key(team)}/${season}/games/${gameId}.json`
}

/** A team report card: /jazz/<game-slug>, the date plus the opponent's
 * lowercase tricode (the URL contract in docs/plans/jazz-first-site.md). */
export function teamGameUrl(team: TeamConfig, slug: string): string {
  return `${import.meta.env.BASE_URL}${team.slug}/${slug}`
}

export function teamLogoUrl(team: TeamConfig): string | null {
  return team.teamLogoPath ? `${import.meta.env.BASE_URL}${team.teamLogoPath}` : null
}
