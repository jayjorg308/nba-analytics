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

export function teamGameUrl(team: TeamConfig, gameId: string): string {
  return `${import.meta.env.BASE_URL}${team.slug}/${gameId}`
}

export function teamLogoUrl(team: TeamConfig): string | null {
  return team.teamLogoPath ? `${import.meta.env.BASE_URL}${team.teamLogoPath}` : null
}
