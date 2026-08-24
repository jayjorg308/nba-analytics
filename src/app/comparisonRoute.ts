// The comparison page's URL contract (ADR-0076): a valid comparison is
// fully identified by its query string and reproducible from it — no hidden
// component state, no server state. This module is the pure parse /
// validate / serialize seam: routes.ts reserves the path segment, React
// derives everything from the state returned here.
//
// Invalid, incomplete, or contradictory queries resolve to the SETUP state
// with a plain message — never a throw, and never a fall-through to the
// hero directory. Validation here is registry-shaped (players exist, seasons
// are on file, players are distinct); data-shaped invariants (a split date
// leaving shots on both sides) belong to aggregateComparison.

import type { ComparisonMode } from '../domain/aggregateComparison'
import type { HeroConfig } from '../heroes/types'

export type { ComparisonMode } from '../domain/aggregateComparison'

/** A fully validated comparison request — everything the page needs to
 * fetch payloads and aggregate, straight from the URL. */
export type ComparisonRequest =
  | { mode: 'players'; season: string; left: string; right: string }
  | { mode: 'split'; season: string; player: string; split: string }

/** The recognized query fields, as written — kept whole so the setup form
 * can preselect what a partial link carried (a HeroPage links its player
 * and season; the setup asks for the rest). */
export interface ComparisonQueryFields {
  mode?: string
  season?: string
  left?: string
  right?: string
  player?: string
  split?: string
  /** Parameter names outside the contract — their presence is invalid. */
  unknownKeys: readonly string[]
}

export type ComparisonRouteState =
  | {
      kind: 'setup'
      /** The mode the setup form opens in. */
      mode: ComparisonMode
      /** Plain validation sentence; null for a bare /compare. */
      message: string | null
      prefill: ComparisonQueryFields
    }
  | { kind: 'valid'; request: ComparisonRequest }

const KNOWN_KEYS = ['mode', 'season', 'left', 'right', 'player', 'split'] as const
type KnownKey = (typeof KNOWN_KEYS)[number]

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** A calendar-real ISO date — 2026-02-30 must not parse. */
function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** Syntactic read of the query string. Never throws; validation is
 * validateComparisonQuery's job. */
export function parseComparisonQuery(search: string): ComparisonQueryFields {
  const params = new URLSearchParams(search)
  const fields: ComparisonQueryFields & Partial<Record<KnownKey, string>> = {
    unknownKeys: [...new Set([...params.keys()])].filter(
      (k) => !(KNOWN_KEYS as readonly string[]).includes(k),
    ),
  }
  for (const key of KNOWN_KEYS) {
    const value = params.get(key)
    if (value !== null) fields[key] = value
  }
  return fields
}

function setup(
  mode: ComparisonMode,
  message: string | null,
  prefill: ComparisonQueryFields,
): ComparisonRouteState {
  return { kind: 'setup', mode, message, prefill }
}

/** A registered player carrying the season, or the specific reason not. */
function playerProblem(
  slug: string,
  season: string,
  heroes: readonly HeroConfig[],
): string | null {
  const hero = heroes.find((h) => h.slug === slug)
  if (hero === undefined) return `No player named "${slug}" is on file.`
  if (!hero.seasons.some((s) => s.season === season)) {
    return `${hero.playerName} has no ${season} season on file.`
  }
  return null
}

/**
 * Registry-shaped validation of a parsed query. Every failure resolves to
 * the setup state with a specific plain message; only a complete, coherent
 * query becomes a valid request.
 */
export function validateComparisonQuery(
  fields: ComparisonQueryFields,
  heroes: readonly HeroConfig[],
): ComparisonRouteState {
  const formMode: ComparisonMode = fields.mode === 'split' ? 'split' : 'players'

  if (fields.unknownKeys.length > 0) {
    return setup(
      formMode,
      `The comparison link carries parameters this page does not read (${fields.unknownKeys.join(', ')}).`,
      fields,
    )
  }

  const anyField =
    fields.season !== undefined ||
    fields.left !== undefined ||
    fields.right !== undefined ||
    fields.player !== undefined ||
    fields.split !== undefined

  if (fields.mode === undefined) {
    // Bare /compare is the setup state in Players mode, quietly; a modeless
    // link that still carries fields is incomplete and says so.
    return setup('players', anyField ? 'The comparison link is missing its mode.' : null, fields)
  }
  if (fields.mode !== 'players' && fields.mode !== 'split') {
    return setup('players', `"${fields.mode}" is not a comparison mode.`, fields)
  }

  if (fields.mode === 'players') {
    if (fields.player !== undefined || fields.split !== undefined) {
      return setup(
        'players',
        'A player comparison takes a season and two players, not player or split parameters.',
        fields,
      )
    }
    const { season, left, right } = fields
    if (season === undefined || left === undefined || right === undefined) {
      const missing = [
        season === undefined ? 'a season' : null,
        left === undefined ? 'a left player' : null,
        right === undefined ? 'a right player' : null,
      ].filter((m) => m !== null)
      return setup('players', `Pick ${missing.join(' and ')} to compare.`, fields)
    }
    if (left === right) {
      return setup('players', 'Pick two different players to compare.', fields)
    }
    for (const slug of [left, right]) {
      const problem = playerProblem(slug, season, heroes)
      if (problem !== null) return setup('players', problem, fields)
    }
    return { kind: 'valid', request: { mode: 'players', season, left, right } }
  }

  if (fields.left !== undefined || fields.right !== undefined) {
    return setup(
      'split',
      'A before-and-since comparison takes one player, a season, and a split date, not left or right parameters.',
      fields,
    )
  }
  const { season, player, split } = fields
  if (season === undefined || player === undefined || split === undefined) {
    const missing = [
      player === undefined ? 'a player' : null,
      season === undefined ? 'a season' : null,
      split === undefined ? 'a split date' : null,
    ].filter((m) => m !== null)
    return setup('split', `Pick ${missing.join(' and ')} to compare.`, fields)
  }
  if (!isRealIsoDate(split)) {
    return setup(
      'split',
      `"${split}" is not a real date. The split date takes YYYY-MM-DD form.`,
      fields,
    )
  }
  const problem = playerProblem(player, season, heroes)
  if (problem !== null) return setup('split', problem, fields)
  return { kind: 'valid', request: { mode: 'split', season, player, split } }
}

/**
 * The canonical query string for a valid request — the URL a valid setup
 * submission navigates to, and the URL every example or discovery link
 * carries. Fixed parameter order so equal comparisons share one string.
 */
export function serializeComparison(request: ComparisonRequest): string {
  const params = new URLSearchParams()
  params.set('mode', request.mode)
  params.set('season', request.season)
  if (request.mode === 'players') {
    params.set('left', request.left)
    params.set('right', request.right)
  } else {
    params.set('player', request.player)
    params.set('split', request.split)
  }
  return `?${params.toString()}`
}
