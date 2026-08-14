// The comparison page (comparison plan; ADR-0073..0077): a tool, not an
// argument — no verdict, no banner, no winner. The URL owns the whole
// comparison state (ADR-0076): this component parses it, fetches the one or
// two deployed shot payloads it names, hands them to the pure comparison
// aggregation, and renders. Invalid or incomplete URLs stay in the setup
// state with a plain message — never a partial render, never the directory.
//
// The headline and zone sections below are still the increment 1 plain
// rendering; increments 3–4 replace them with the two-axis headline surface
// and the paired zone evidence.

import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ComparisonZoneChart } from '../chart/ComparisonZoneChart'
import type { ComparisonMetrics, ComparisonMode } from '../domain/aggregateComparison'
import {
  aggregatePlayerComparison,
  aggregateSplitComparison,
} from '../domain/aggregateComparison'
import { formatGameDate } from '../format'
import { HEROES, heroBySlug } from '../heroes/registry'
import type { HeroConfig } from '../heroes/types'
import { compareUrl, payloadUrl } from '../heroes/urls'
import { ComparisonHeader } from './ComparisonHeader'
import { ComparisonHeadline } from './ComparisonHeadline'
import { ComparisonZoneTable } from './ComparisonZoneTable'
import { Term } from './Term'
import type { ComparisonQueryFields, ComparisonRequest } from './comparisonRoute'
import { parseComparisonQuery, validateComparisonQuery } from './comparisonRoute'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import { useOptionalComparisonPayload } from './usePayload'

const EXAMPLE_PLAYERS: ComparisonRequest = {
  mode: 'players',
  season: '2025-26',
  left: 'donovan-mitchell',
  right: 'jalen-brunson',
}
const EXAMPLE_SPLIT: ComparisonRequest = {
  mode: 'split',
  season: '2025-26',
  player: 'donovan-mitchell',
  split: '2026-02-07',
}

// --- Registry-derived options (plan §1: never offer a configuration
// without deployed registry support) ---------------------------------------

/** Seasons a player comparison can offer: carried by at least two heroes. */
function playersModeSeasons(): string[] {
  const counts = new Map<string, number>()
  for (const hero of HEROES) {
    for (const s of hero.seasons) counts.set(s.season, (counts.get(s.season) ?? 0) + 1)
  }
  return [...counts]
    .filter(([, n]) => n >= 2)
    .map(([season]) => season)
    .sort()
    .reverse()
}

function heroesCarrying(season: string): HeroConfig[] {
  return HEROES.filter((h) => h.seasons.some((s) => s.season === season))
}

/** A hero's argued seasons, latest first. */
function heroSeasonsDesc(hero: HeroConfig): string[] {
  return hero.seasons
    .map((s) => s.season)
    .sort()
    .reverse()
}

// --- Setup form (plan §1) ---------------------------------------------------

export interface SetupInitial {
  mode: ComparisonMode
  season?: string
  left?: string
  right?: string
  player?: string
  split?: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Keep only prefill values the form can actually offer, so a mangled link
 * degrades to blank controls instead of unsubmittable hidden state. */
function sanitizeInitial(mode: ComparisonMode, fields: ComparisonQueryFields): SetupInitial {
  const slugOrUndefined = (slug: string | undefined) =>
    slug !== undefined && heroBySlug(slug) !== undefined ? slug : undefined
  return {
    mode,
    season: fields.season,
    left: slugOrUndefined(fields.left),
    right: slugOrUndefined(fields.right),
    player: slugOrUndefined(fields.player),
    split: fields.split !== undefined && ISO_DATE.test(fields.split) ? fields.split : undefined,
  }
}

/**
 * The setup and controls (plan §1): real labels, native form semantics, a
 * compact mode control, registry-derived options only. A valid submit owns
 * URL navigation — it goes to the canonical serialized URL, and the result
 * is derived from that URL, never from hidden component state (ADR-0076).
 * Exported for its component tests; `navigate` is the test seam.
 */
export function ComparisonSetup({
  initial,
  urlMessage,
  navigate = (url) => window.location.assign(url),
}: {
  initial: SetupInitial
  /** The URL-derived validation sentence (null when the URL was bare or
   * valid); a submit attempt replaces it with its own result. */
  urlMessage: string | null
  navigate?: (url: string) => void
}) {
  const seasonsForPlayers = useMemo(() => playersModeSeasons(), [])
  const [mode, setMode] = useState<ComparisonMode>(initial.mode)
  const [season, setSeason] = useState<string>(() => {
    if (initial.mode === 'split') {
      const hero = initial.player === undefined ? undefined : heroBySlug(initial.player)
      if (hero !== undefined) {
        return initial.season !== undefined && heroSeasonsDesc(hero).includes(initial.season)
          ? initial.season
          : heroSeasonsDesc(hero)[0]!
      }
      return initial.season ?? ''
    }
    return initial.season !== undefined && seasonsForPlayers.includes(initial.season)
      ? initial.season
      : (seasonsForPlayers[0] ?? '')
  })
  const [left, setLeft] = useState(initial.left ?? '')
  const [right, setRight] = useState(initial.right ?? '')
  const [player, setPlayer] = useState(initial.player ?? '')
  const [split, setSplit] = useState(initial.split ?? '')
  const [localMessage, setLocalMessage] = useState<string | null>(null)

  const message = localMessage ?? urlMessage

  function switchMode(next: ComparisonMode) {
    setMode(next)
    setLocalMessage(null)
    if (next === 'players') {
      if (!seasonsForPlayers.includes(season)) setSeason(seasonsForPlayers[0] ?? '')
    } else {
      const hero = player === '' ? undefined : heroBySlug(player)
      if (hero !== undefined && !heroSeasonsDesc(hero).includes(season)) {
        setSeason(heroSeasonsDesc(hero)[0]!)
      }
    }
  }

  function onPlayersSeasonChange(next: string) {
    setSeason(next)
    // A player who does not carry the new season is no longer offerable.
    if (left !== '' && !heroesCarrying(next).some((h) => h.slug === left)) setLeft('')
    if (right !== '' && !heroesCarrying(next).some((h) => h.slug === right)) setRight('')
  }

  function onSplitPlayerChange(next: string) {
    setPlayer(next)
    const hero = next === '' ? undefined : heroBySlug(next)
    if (hero !== undefined && !heroSeasonsDesc(hero).includes(season)) {
      setSeason(heroSeasonsDesc(hero)[0]!)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const fields: ComparisonQueryFields =
      mode === 'players'
        ? {
            mode,
            season: season === '' ? undefined : season,
            left: left === '' ? undefined : left,
            right: right === '' ? undefined : right,
            unknownKeys: [],
          }
        : {
            mode,
            season: season === '' ? undefined : season,
            player: player === '' ? undefined : player,
            split: split === '' ? undefined : split,
            unknownKeys: [],
          }
    const result = validateComparisonQuery(fields, HEROES)
    if (result.kind === 'valid') {
      navigate(compareUrl(result.request))
    } else {
      setLocalMessage(result.message)
    }
  }

  const splitHero = player === '' ? undefined : heroBySlug(player)
  const playerOptions = (heroes: HeroConfig[]) =>
    heroes.map((h) => (
      <option key={h.slug} value={h.slug}>
        {h.playerName}
      </option>
    ))

  return (
    <form
      className="comparison-setup"
      action={compareUrl()}
      method="get"
      onSubmit={handleSubmit}
      aria-label="Set up a comparison"
    >
      <fieldset className="comparison-mode">
        <legend className="visually-hidden">Comparison mode</legend>
        <label className={mode === 'players' ? 'mode-active' : undefined}>
          <input
            type="radio"
            name="mode"
            value="players"
            checked={mode === 'players'}
            onChange={() => switchMode('players')}
          />
          Players
        </label>
        <label className={mode === 'split' ? 'mode-active' : undefined}>
          <input
            type="radio"
            name="mode"
            value="split"
            checked={mode === 'split'}
            onChange={() => switchMode('split')}
          />
          Before &amp; since
        </label>
      </fieldset>
      <div className={`comparison-fields comparison-fields-${mode}`}>
        {mode === 'players' ? (
          <>
            <label className="comparison-field comparison-field-season">
              <span>Season</span>
              <select
                name="season"
                required
                value={season}
                onChange={(e) => onPlayersSeasonChange(e.target.value)}
              >
                {seasonsForPlayers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="comparison-field comparison-field-left">
              <span>Left player</span>
              <select name="left" required value={left} onChange={(e) => setLeft(e.target.value)}>
                <option value="">Choose a player</option>
                {playerOptions(heroesCarrying(season))}
              </select>
            </label>
            <button
              type="button"
              className="comparison-swap comparison-action-swap"
              onClick={() => {
                setLeft(right)
                setRight(left)
              }}
            >
              Swap
            </button>
            <label className="comparison-field comparison-field-right">
              <span>Right player</span>
              <select name="right" required value={right} onChange={(e) => setRight(e.target.value)}>
                <option value="">Choose a player</option>
                {playerOptions(heroesCarrying(season))}
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="comparison-field comparison-field-player">
              <span>Player</span>
              <select
                name="player"
                required
                value={player}
                onChange={(e) => onSplitPlayerChange(e.target.value)}
              >
                <option value="">Choose a player</option>
                {playerOptions([...HEROES])}
              </select>
            </label>
            <label className="comparison-field comparison-field-season">
              <span>Season</span>
              <select
                name="season"
                required
                disabled={splitHero === undefined}
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              >
                {splitHero === undefined ? (
                  <option value="">Choose a player first</option>
                ) : (
                  heroSeasonsDesc(splitHero).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="comparison-field comparison-field-split">
              <span>Split date</span>
              <input
                type="date"
                name="split"
                required
                value={split}
                onChange={(e) => setSplit(e.target.value)}
              />
            </label>
          </>
        )}
        <button type="submit" className="comparison-go comparison-action-go">
          Compare
        </button>
      </div>
      {/* role="alert": the message changes on a failed submit, and a silent
          rejection strands a screen-reader user on a form that did nothing.
          URL-derived messages render with the page load and announce once. */}
      {message !== null && (
        <p className="comparison-message" role="alert">
          {message}
        </p>
      )}
    </form>
  )
}

// --- The page ---------------------------------------------------------------

type Computed =
  | { status: 'pending' }
  | { status: 'error'; message: string }
  | { status: 'ready'; metrics: ComparisonMetrics }

export function ComparisonPage({ navigate }: { navigate?: (url: string) => void }) {
  // ADR-0076: the URL is the whole comparison state, read once at mount
  // like every other route (navigation is full page loads).
  const state = useMemo(
    () => validateComparisonQuery(parseComparisonQuery(window.location.search), HEROES),
    [],
  )
  const request = state.kind === 'valid' ? state.request : null
  // A valid request's slugs passed registry validation, so the lookups hold.
  const leftUrl =
    request === null
      ? null
      : payloadUrl(
          heroBySlug(request.mode === 'players' ? request.left : request.player)!,
          request.season,
        )
  const rightUrl =
    request?.mode === 'players' ? payloadUrl(heroBySlug(request.right)!, request.season) : null
  const leftState = useOptionalComparisonPayload(leftUrl)
  const rightState = useOptionalComparisonPayload(rightUrl)

  // Distinct, descriptive titles per mode; the setup state keeps the
  // wordmark-prefixed static-page form (the methodology pattern, ADR-0071).
  const title = useMemo(() => {
    if (request === null) return 'Compare · Good Shots'
    if (request.mode === 'players') {
      return `${heroBySlug(request.left)!.playerName} vs ${heroBySlug(request.right)!.playerName} · ${request.season} · comparison`
    }
    return `${heroBySlug(request.player)!.playerName} · ${request.season} · before & since ${formatGameDate(request.split)}`
  }, [request])
  useEffect(() => {
    document.title = title
  }, [title])

  // The single comparison aggregation call site. Invariant violations are a
  // plain page error (the HeroPage contract), never a partial render.
  const computed: Computed = useMemo(() => {
    if (request === null || leftState.status !== 'ready') return { status: 'pending' }
    try {
      if (request.mode === 'players') {
        if (rightState.status !== 'ready') return { status: 'pending' }
        return {
          status: 'ready',
          metrics: aggregatePlayerComparison({
            season: request.season,
            left: { slug: request.left, payload: leftState.payload },
            right: { slug: request.right, payload: rightState.payload },
          }),
        }
      }
      return {
        status: 'ready',
        metrics: aggregateSplitComparison({
          slug: request.player,
          season: request.season,
          splitDate: request.split,
          payload: leftState.payload,
        }),
      }
    } catch (e) {
      return { status: 'error', message: e instanceof Error ? e.message : String(e) }
    }
  }, [request, leftState, rightState])

  if (state.kind === 'setup') {
    return (
      <>
        <main className="comparison-page">
          <SiteNav />
          <header className="comparison-intro">
            <p className="section-kicker">COMPARE</p>
            <h1 className="comparison-title">Two shot profiles, side by side</h1>
            <p className="comparison-deck">
              Two players in one season, or one player before and since a date. Shot selection
              and shot making over exact windows, vs one league average.
            </p>
          </header>
          <ComparisonSetup
            initial={sanitizeInitial(state.mode, state.prefill)}
            urlMessage={state.message}
            navigate={navigate}
          />
          <section className="comparison-examples" aria-label="Example comparisons">
            <p>Try an example:</p>
            <ul>
              <li>
                <a href={compareUrl(EXAMPLE_PLAYERS)}>Donovan Mitchell vs Jalen Brunson, 2025-26</a>
              </li>
              <li>
                <a href={compareUrl(EXAMPLE_SPLIT)}>
                  Donovan Mitchell, before &amp; since Feb 7, 2026
                </a>
              </li>
            </ul>
          </section>
        </main>
        <SiteFooter directoryLink />
      </>
    )
  }

  const setupInitial: SetupInitial =
    request!.mode === 'players'
      ? { mode: 'players', season: request!.season, left: request!.left, right: request!.right }
      : {
          mode: 'split',
          season: request!.season,
          player: request!.player,
          split: request!.split,
        }
  const setup = <ComparisonSetup initial={setupInitial} urlMessage={null} navigate={navigate} />
  const statusMessage =
    leftState.status === 'error'
      ? leftState.message
      : rightState.status === 'error'
        ? rightState.message
        : computed.status === 'error'
          ? computed.message
          : null
  return (
    <>
      <main className="comparison-page comparison-page-results">
        <SiteNav />
        {statusMessage !== null ? (
          <>
            {setup}
            <p className="page-status page-error">{statusMessage}</p>
          </>
        ) : computed.status !== 'ready' ? (
          <>
            {setup}
            <p className="page-status page-loading">Loading shot data…</p>
          </>
        ) : (
          <>
            <ComparisonHeader metrics={computed.metrics} />
            <details className="comparison-change">
              <summary>Change comparison</summary>
              {setup}
            </details>
            <ComparisonHeadline metrics={computed.metrics} />
            {/* The zone evidence (plan §4): both axes simultaneously over
                the same six rows — panels together on desktop, stacked on
                mobile — with the full-width accessible table twin below.
                Deliberately NOT the acts' split layout: twelve columns of
                paired numbers need the whole shell's width to stay a
                no-scroll desktop table. */}
            <section className="comparison-zones" aria-labelledby="comparison-zone-caption">
              <header className="section-caption">
                <h2 id="comparison-zone-caption">ZONE BY ZONE</h2>
                <p className="section-caption-desc">
                  shot diet and <Term id="shot-making">shot making</Term> per zone, each window
                  vs the shared league average (
                  <Term id="making-delta">making Δ</Term> in FG percentage&nbsp;points)
                </p>
              </header>
              <ComparisonZoneChart metrics={computed.metrics} />
              <ComparisonZoneTable metrics={computed.metrics} />
            </section>
          </>
        )}
      </main>
      <SiteFooter directoryLink />
    </>
  )
}
