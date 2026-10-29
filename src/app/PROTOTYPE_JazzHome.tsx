// PROTOTYPE (throwaway, docs/plans/jazz-home-transition.md, Stage 3): two
// variants of the Jazz home on the real routes, `/?variant=` and
// `/jazz?variant=` (0 = today's page at that route), dev builds only. Both
// render the same content in the plan's order (decisions 7, 8, 9, 14, 15)
// over the published 2026-27 files; they disagree about structure:
//   A · Acts: one column, every block a numbered act at poster scale, the
//     players as portrait headshot cards, the arguments as the directory rail.
//   B · Front page: the latest game and the players share the first screen
//     in two columns, the previous games as a scoreboard strip, the players
//     as landscape rows, the evidence under plain captions, the arguments as
//     a typographic list.
// Delete after the pick (with PROTOTYPE_JazzHome.css and the App.tsx hook).

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ChartPanel } from '../chart/ChartPanel'
import { GameQuadrant } from '../chart/GameQuadrant'
import { aggregateTeam } from '../domain/aggregateTeam'
import type { TeamMetrics } from '../domain/aggregateTeam'
import { SMALL_SAMPLE_MAKING_ATTEMPTS, ZONE_INCLUSION_MIN_ATTEMPTS } from '../domain/constants'
import type { LedgerFacts } from '../domain/ledgerFacts'
import { buildPlayerSeason, seasonShooters } from '../domain/playerSeason'
import type { PlayerSeason } from '../domain/playerSeason'
import { seasonDots } from '../domain/reportCard'
import type { GameDot } from '../domain/reportCard'
import type { AssistStatus } from '../domain/shotContextPayload'
import type { TeamSeasonIndex } from '../domain/teamSeasonIndex'
import type { TeamShotPayload } from '../domain/teamShotPayload'
import { formatMatchup, formatMonthDay, formatSignedGap } from '../format'
import { HEROES, heroBySlug } from '../heroes/registry'
import type { HeroConfig } from '../heroes/types'
import { headshotUrl, heroPageUrl } from '../heroes/urls'
import { makingAnswer, nightTitle, QUESTIONS, selectionAnswer } from '../teams/computedCopy'
import { TEAM_COPY } from '../teams/copy'
import type { TeamConfig } from '../teams/registry'
import {
  ledgerFactsUrl,
  playerHeadshotUrl,
  teamGameUrl,
  teamLogoUrl,
  teamPlayerUrl,
  teamSeasonIndexUrl,
  teamShotPayloadUrl,
} from '../teams/urls'
import { PosterBanner } from './PosterBanner'
import { displayedGaps, gameBannerArt } from './reportCardDisplay'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import { TeamLedgerTable } from './TeamLedgerTable'
import { useLedgerFacts, useOptionalTeamSeasonIndex, useOptionalTeamShotPayload, useTeamSeasonIndex, useTeamShotPayload } from './usePayload'
import { ZoneTable } from './ZoneTable'
import './PROTOTYPE_JazzHome.css'

// The build moves this into the team registry, guarded equal to
// season.config.json's live hero seasons.
const FEATURED = ['keyonte-george', 'ace-bailey', 'darryn-peterson']

// ------------------------------------------------------------------ data

interface Home {
  team: TeamConfig
  season: string
  metrics: TeamMetrics
  payload: TeamShotPayload
  dots: GameDot[]
  priorDots: GameDot[]
  priorSeason: string | null
  latest: GameDot
  previous: GameDot[]
  featured: PlayerSeason[]
  rest: { slug: string; name: string; onRoster: boolean }[]
  arguments: { jazz: HeroConfig[]; league: HeroConfig[] }
}

function buildHome(
  team: TeamConfig,
  season: string,
  payload: TeamShotPayload,
  ledger: LedgerFacts,
  index: TeamSeasonIndex,
  prior?: { index: TeamSeasonIndex; payload: TeamShotPayload },
): Home {
  const dots = seasonDots(index, payload)
  const latest = dots.at(-1)!
  const featured = FEATURED.map((slug) => buildPlayerSeason(slug, payload, index)).filter(
    (p): p is PlayerSeason => p !== null,
  )
  const rostered = new Set(payload.roster.map((r) => r.playerId))
  const rest = seasonShooters(payload)
    .filter((p) => !FEATURED.includes(p.slug))
    .map((p) => ({ slug: p.slug, name: p.name, onRoster: rostered.has(p.playerId) }))
  const isJazz = (h: HeroConfig) => h.seasons.some((s) => s.teamPage === team.slug)
  return {
    team,
    season,
    metrics: aggregateTeam(payload, ledger, index),
    payload,
    dots,
    priorDots: prior ? seasonDots(prior.index, prior.payload) : [],
    priorSeason: prior ? prior.index._meta.season : null,
    latest,
    previous: dots.slice(-4, -1).reverse(),
    featured,
    rest,
    arguments: { jazz: HEROES.filter(isJazz), league: HEROES.filter((h) => !isJazz(h)) },
  }
}

/** A game's two displayed numbers and their computed words. */
function readGame(d: GameDot) {
  const m = d.metrics
  const gaps = displayedGaps(m)
  return {
    date: formatMonthDay(d.gameDate),
    matchup: formatMatchup(d.opponent, d.home),
    score: `${d.won ? 'W' : 'L'} ${d.teamScore}–${d.opponentScore}`,
    title: nightTitle(gaps.selection, gaps.making),
    selection: formatSignedGap(m.selection.playerDietExpectedPps, m.selection.leagueDietExpectedPps, 2),
    making: formatSignedGap(m.making.actualPps, m.selection.playerDietExpectedPps, 2),
    selectionWords: selectionAnswer(gaps.selection),
    makingWords: makingAnswer(gaps.making),
    priced: m.evalAttempts,
  }
}

/** A featured player's card numbers, with the making flag below the bar. */
function readPlayer(ps: PlayerSeason) {
  const m = ps.metrics
  const flagged = m.evalAttempts < SMALL_SAMPLE_MAKING_ATTEMPTS
  const zonesAtBar = m.zones.filter((z) => z.attempts >= ZONE_INCLUSION_MIN_ATTEMPTS).length
  const zonesTotal = m.zones.length
  return {
    selection: formatSignedGap(m.selection.playerDietExpectedPps, m.selection.leagueDietExpectedPps, 2),
    making: formatSignedGap(m.making.actualPps, m.selection.playerDietExpectedPps, 2) + (flagged ? '†' : ''),
    flagged,
    priced: m.evalAttempts,
    games: ps.games.length,
    zonesAtBar,
    zonesTotal,
    status: statusLine(ps),
  }
}

/** DRAFT (an open detail in the plan): the argument's one structural line. */
function statusLine(ps: PlayerSeason): string {
  const hero = heroBySlug(ps.player.slug)
  if (hero === undefined) return 'First argument to come'
  if (hero.seasons.some((s) => s.season === ps.season)) return `${ps.season} argument on file`
  return `${hero.canonicalSeason} argument on file. ${ps.season} to come`
}

function Draft() {
  return <span className="draft-tag">draft copy</span>
}

// ------------------------------------------------------------------ shared pieces

function SeasonBanner({ h }: { h: Home }) {
  return (
    <PosterBanner
      art={{ kind: 'type' }}
      logoUrl={teamLogoUrl(h.team)}
      kicker={`${h.season} · through ${formatMonthDay(h.metrics.dataThrough)} · ${h.metrics.games} games`}
      title={h.team.name}
      cue="↓ The latest game"
      className="proto-home-poster"
    />
  )
}

function Quadrant({ h }: { h: Home }) {
  return (
    <GameQuadrant
      dots={h.dots}
      tonight={h.latest}
      priorDots={h.priorDots}
      season={h.season}
      priorSeason={h.priorSeason}
      hrefOf={(d) => teamGameUrl(h.team, d.slug)}
      ariaLabel={`Every ${h.team.name} game so far, shot diet against conversion`}
      tonightLabel="the latest game"
    />
  )
}

function Zones({ h }: { h: Home }) {
  const noAssists = useMemo(() => new Map<string, AssistStatus>(), [])
  return (
    <div className="section-layout">
      <ChartPanel
        shots={h.payload.shots}
        zones={h.metrics.profile.zones}
        assistStatusByShotKey={noAssists}
        shotTooltips={false}
        ariaLabel={`Half-court shot chart: ${h.metrics.profile.totalAttempts} shots by the ${h.team.name}, ${h.season}`}
      />
      <ZoneTable metrics={h.metrics.profile} zoneConflictsDropped={h.metrics.zoneConflictsDropped} />
    </div>
  )
}

function Caption({ id, kicker, title, desc }: { id: string; kicker?: string; title: string; desc?: ReactNode }) {
  return (
    <header className="section-caption">
      {kicker && <p className="section-kicker">{kicker}</p>}
      <h2 id={id}>{title}</h2>
      {desc && <p className="section-caption-desc">{desc}</p>}
    </header>
  )
}

const QUADRANT_DESC =
  'every game so far, its shot diet against the league’s across and its conversion against expected up, each priced against the league as it stood that day'
const ZONE_DESC = 'the team’s shot diet and shot making, vs league average (making Δ in FG percentage points)'

// ------------------------------------------------------------------ A · Acts

function VariantA({ h }: { h: Home }) {
  const g = readGame(h.latest)
  const { art } = gameBannerArt(h.latest.slug)
  return (
    <>
      <SeasonBanner h={h} />

      <section className="report-section report-first" aria-labelledby="pa-latest">
        <Caption id="pa-latest" kicker="01 · THE LATEST GAME" title={`${g.date.toUpperCase()} ${g.matchup.toUpperCase()}`} />
        <a className={`pa-feature ${art.kind === 'photo' ? 'has-photo' : ''}`} href={teamGameUrl(h.team, h.latest.slug)}>
          <div className="pa-feature-face">
            {art.kind === 'photo' && <img className="pa-feature-photo" src={art.src} alt={art.alt} />}
            <img className="pa-feature-logo" src={teamLogoUrl(h.team) ?? ''} alt="" aria-hidden="true" />
            <p className="pa-feature-score">{g.score}</p>
            <p className="pa-feature-title">{g.title}</p>
            <p className="pa-feature-cue">The card →</p>
          </div>
          <div className="pa-feature-answers">
            <div className="answer">
              <p className="answer-question">{QUESTIONS.selection}</p>
              <p className="answer-number">{g.selection}</p>
              <p className="answer-words">{g.selectionWords}</p>
            </div>
            <div className="answer">
              <p className="answer-question">{QUESTIONS.making}</p>
              <p className="answer-number">{g.making}</p>
              <p className="answer-words">{g.makingWords}</p>
            </div>
            <p className="answer-note">{g.priced} priced shots</p>
          </div>
        </a>
        <h3 className="pa-subhead">The three before</h3>
        <ul className="pa-tiles">
          {h.previous.map((d) => {
            const r = readGame(d)
            return (
              <li key={d.gameId}>
                <a className="pa-tile" href={teamGameUrl(h.team, d.slug)}>
                  <span className="pa-tile-date">
                    {r.date} · {r.matchup}
                  </span>
                  <span className="pa-tile-score">{r.score}</span>
                  <span className="pa-tile-line">
                    <b>{r.selection}</b> {r.selectionWords}
                  </span>
                  <span className="pa-tile-line">
                    <b>{r.making}</b> {r.makingWords}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="report-section" aria-labelledby="pa-players">
        <Caption
          id="pa-players"
          kicker="02 · THE PLAYERS"
          title="THE THREE"
          desc="the players this season is about, each with his season so far against the league average"
        />
        <ul className="pa-cards">
          {h.featured.map((ps) => {
            const r = readPlayer(ps)
            return (
              <li key={ps.player.slug}>
                <a className="pa-card" href={teamPlayerUrl(h.team, h.season, ps.player.slug)}>
                  <span className="pa-card-figure">
                    <img src={playerHeadshotUrl(ps.player.slug)} alt="" />
                    <span className="pa-card-name">{ps.player.name}</span>
                  </span>
                  <span className="pa-card-meta">
                    {ps.number !== null ? `Nº ${ps.number} · ` : ''}
                    {r.games} games · {r.priced} priced shots
                  </span>
                  <span className="pa-card-pair">
                    <span>
                      <b>{r.selection}</b>
                      <small>shot diet vs the league’s</small>
                    </span>
                    <span>
                      <b>{r.making}</b>
                      <small>conversion vs expected</small>
                    </span>
                  </span>
                  <span className="pa-card-status">
                    {r.status} <Draft />
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
        {h.featured.some((ps) => readPlayer(ps).flagged) && (
          <p className="table-note">† conversion on fewer than {SMALL_SAMPLE_MAKING_ATTEMPTS} priced shots</p>
        )}
        <Rail h={h} className="pa-rail" />
      </section>

      <section className="report-section" aria-labelledby="pa-quadrant">
        <Caption id="pa-quadrant" kicker="03 · THE GAMES" title="THE SEASON SO FAR" desc={QUADRANT_DESC} />
        <div className="player-quadrant">
          <Quadrant h={h} />
        </div>
      </section>

      <section className="report-section" aria-labelledby="pa-zones">
        <Caption id="pa-zones" kicker="04 · THE FLOOR" title={TEAM_COPY.profileCaption} desc={ZONE_DESC} />
        <Zones h={h} />
      </section>

      <section className="report-section" aria-labelledby="pa-ledger">
        <Caption id="pa-ledger" kicker="05 · THE LEDGER" title={TEAM_COPY.ledgerCaption} desc={TEAM_COPY.ledgerDesc} />
        <TeamLedgerTable team={h.team} rows={h.metrics.ledger} />
      </section>

      <section className="report-section" aria-labelledby="pa-arguments">
        <Caption
          id="pa-arguments"
          kicker="06 · THE ARGUMENTS"
          title="ARGUMENTS"
          desc="one question of a player's season, “Is he taking good shots?”, argued verdict first and evidence after"
        />
        <ul className="pa-arg-rail">
          {[...h.arguments.jazz, ...h.arguments.league].map((hero) => (
            <li key={hero.slug}>
              <a className="index-card" href={heroPageUrl(hero)}>
                <img src={headshotUrl(hero)} alt="" />
                <span className="index-card-name">{hero.playerName}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="pa-all">
          <a href="/arguments">All arguments →</a>
        </p>
      </section>
    </>
  )
}

function Rail({ h, className }: { h: Home; className: string }) {
  const here = h.rest.filter((p) => p.onRoster)
  const gone = h.rest.filter((p) => !p.onRoster)
  return (
    <div className={className}>
      <h3 className="pa-subhead">Everyone else</h3>
      <ul>
        {here.map((p) => (
          <li key={p.slug}>
            <a href={teamPlayerUrl(h.team, h.season, p.slug)}>{p.name}</a>
          </li>
        ))}
      </ul>
      {gone.length > 0 && (
        <>
          <h3 className="pa-subhead">No longer on the roster</h3>
          <ul>
            {gone.map((p) => (
              <li key={p.slug}>
                <a href={teamPlayerUrl(h.team, h.season, p.slug)}>{p.name}</a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ B · Front page

function VariantB({ h }: { h: Home }) {
  const g = readGame(h.latest)
  const { art } = gameBannerArt(h.latest.slug)
  return (
    <>
      <SeasonBanner h={h} />

      <div className="pb-front">
        <section className="pb-game" aria-labelledby="pb-latest">
          <h2 className="pb-label" id="pb-latest">
            The latest game
          </h2>
          <a className={`pb-feature ${art.kind === 'photo' ? 'has-photo' : ''}`} href={teamGameUrl(h.team, h.latest.slug)}>
            {art.kind === 'photo' && <img className="pb-feature-photo" src={art.src} alt={art.alt} />}
            <img className="pb-feature-logo" src={teamLogoUrl(h.team) ?? ''} alt="" aria-hidden="true" />
            <span className="pb-feature-head">
              <span className="pb-feature-kicker">
                {g.date} · {g.matchup}
              </span>
              <span className="pb-feature-score">{g.score}</span>
              <span className="pb-feature-title">{g.title}</span>
            </span>
            <span className="pb-feature-answers">
              <span className="pb-answer">
                <span className="pb-q">{QUESTIONS.selection}</span>
                <span className="pb-n">{g.selection}</span>
                <span className="pb-w">{g.selectionWords}</span>
              </span>
              <span className="pb-answer">
                <span className="pb-q">{QUESTIONS.making}</span>
                <span className="pb-n">{g.making}</span>
                <span className="pb-w">{g.makingWords}</span>
              </span>
            </span>
          </a>
          <ul className="pb-strip" aria-label="The three games before">
            {h.previous.map((d) => {
              const r = readGame(d)
              return (
                <li key={d.gameId}>
                  <a href={teamGameUrl(h.team, d.slug)}>
                    <span className="pb-strip-head">
                      <span>
                        {r.date} · {r.matchup}
                      </span>
                      <b>{r.score}</b>
                    </span>
                    <span className="pb-strip-line">
                      <b>{r.selection}</b> {r.selectionWords}
                    </span>
                    <span className="pb-strip-line">
                      <b>{r.making}</b> {r.makingWords}
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="pb-players" aria-labelledby="pb-players">
          <h2 className="pb-label" id="pb-players">
            The players
          </h2>
          <ul className="pb-rows">
            {h.featured.map((ps) => {
              const r = readPlayer(ps)
              return (
                <li key={ps.player.slug}>
                  <a className="pb-row" href={teamPlayerUrl(h.team, h.season, ps.player.slug)}>
                    <span className="pb-row-figure">
                      <img src={playerHeadshotUrl(ps.player.slug)} alt="" />
                    </span>
                    <span className="pb-row-body">
                      <span className="pb-row-name">{ps.player.name}</span>
                      <span className="pb-row-meta">
                        {ps.number !== null ? `Nº ${ps.number} · ` : ''}
                        {r.priced} priced shots in {r.games} games
                      </span>
                      <span className="pb-row-pair">
                        <span>
                          <b>{r.selection}</b> diet
                        </span>
                        <span>
                          <b>{r.making}</b> conversion
                        </span>
                      </span>
                      <span className="pb-row-status">
                        {r.status}. {r.zonesAtBar} of {r.zonesTotal} zones at {ZONE_INCLUSION_MIN_ATTEMPTS} attempts{' '}
                        <Draft />
                      </span>
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
          <Rail h={h} className="pb-rail" />
        </section>
      </div>

      <section className="report-section" aria-labelledby="pb-quadrant">
        <Caption id="pb-quadrant" title="THE SEASON SO FAR" desc={QUADRANT_DESC} />
        <div className="pb-season">
          <Quadrant h={h} />
          <p className="pb-season-aside">
            Diet and conversion of every game so far, the latest highlighted, last season’s faded behind. Each dot
            opens its card.
          </p>
        </div>
      </section>

      <section className="report-section" aria-labelledby="pb-zones">
        <Caption id="pb-zones" title={TEAM_COPY.profileCaption} desc={ZONE_DESC} />
        <Zones h={h} />
      </section>

      <section className="report-section" aria-labelledby="pb-ledger">
        <Caption id="pb-ledger" title={TEAM_COPY.ledgerCaption} desc={TEAM_COPY.ledgerDesc} />
        <TeamLedgerTable team={h.team} rows={h.metrics.ledger} />
      </section>

      <section className="report-section pb-arguments" aria-labelledby="pb-arguments">
        <Caption
          id="pb-arguments"
          title="ARGUMENTS"
          desc="one question of a player's season, “Is he taking good shots?”, argued verdict first and evidence after"
        />
        <div className="pb-arg-cols">
          <div>
            <h3 className="pa-subhead">Jazz</h3>
            <ul>
              {h.arguments.jazz.map((hero) => (
                <li key={hero.slug}>
                  <a href={heroPageUrl(hero)}>{hero.playerName}</a> <span>{hero.canonicalSeason}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="pa-subhead">Around the league</h3>
            <ul>
              {h.arguments.league.map((hero) => (
                <li key={hero.slug}>
                  <a href={heroPageUrl(hero)}>{hero.playerName}</a> <span>{hero.canonicalSeason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="pa-all">
          <a href="/arguments">All arguments →</a>
        </p>
      </section>
    </>
  )
}

// ------------------------------------------------------------------ host + switcher

const VARIANTS = ['0', 'A', 'B'] as const
const NAMES: Record<string, string> = { '0': 'today’s page', A: 'Acts', B: 'Front page' }

function priorSeasonOf(season: string): string {
  const start = Number(season.slice(0, 4)) - 1
  return `${start}-${String(start + 1).slice(-2)}`
}

export function PrototypeJazzHome({ team, current, initial }: { team: TeamConfig; current: ReactNode; initial: string }) {
  const [variant, setVariant] = useState<string>(VARIANTS.includes(initial as never) ? initial : 'A')
  const season = team.canonicalSeason
  const prior = priorSeasonOf(season)
  const hasPrior = team.seasons.includes(prior)
  const payloadState = useTeamShotPayload(teamShotPayloadUrl(team, season))
  const ledgerState = useLedgerFacts(ledgerFactsUrl(team, season))
  const indexState = useTeamSeasonIndex(teamSeasonIndexUrl(team, season))
  const priorIndexState = useOptionalTeamSeasonIndex(hasPrior ? teamSeasonIndexUrl(team, prior) : null)
  const priorPayloadState = useOptionalTeamShotPayload(hasPrior ? teamShotPayloadUrl(team, prior) : null)
  const ready =
    payloadState.status === 'ready' &&
    ledgerState.status === 'ready' &&
    indexState.status === 'ready' &&
    priorIndexState.status !== 'loading' &&
    priorPayloadState.status !== 'loading'
  const home = useMemo(() => {
    if (payloadState.status !== 'ready' || ledgerState.status !== 'ready' || indexState.status !== 'ready') return null
    if (priorIndexState.status === 'loading' || priorPayloadState.status === 'loading') return null
    const p =
      priorIndexState.status === 'ready' && priorPayloadState.status === 'ready'
        ? { index: priorIndexState.payload, payload: priorPayloadState.payload }
        : undefined
    return buildHome(team, season, payloadState.payload, ledgerState.payload, indexState.payload, p)
  }, [team, season, payloadState, ledgerState, indexState, priorIndexState, priorPayloadState])

  useEffect(() => {
    if (variant !== '0') document.title = `${team.name} · ${season}`
  }, [variant, team, season])

  function go(step: number) {
    const i = (VARIANTS.indexOf(variant as never) + step + VARIANTS.length) % VARIANTS.length
    const next = VARIANTS[i]!
    setVariant(next)
    const url = new URL(window.location.href)
    url.searchParams.set('variant', next)
    window.history.replaceState(null, '', url)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [contenteditable]')) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const bar = (
    <div className="proto-switcher" role="toolbar" aria-label="Prototype variants">
      <button type="button" onClick={() => go(-1)} aria-label="Previous variant">
        ←
      </button>
      <span>
        {variant} · {NAMES[variant]}
      </span>
      <button type="button" onClick={() => go(1)} aria-label="Next variant">
        →
      </button>
    </div>
  )
  if (variant === '0') {
    return (
      <>
        {current}
        {bar}
      </>
    )
  }
  return (
    <>
      <main className={`hero-page team-page proto-home proto-home-${variant.toLowerCase()}`}>
        <SiteNav />
        {!ready && <p className="page-status page-loading">Loading prototype data…</p>}
        {home && variant === 'A' && <VariantA h={home} />}
        {home && variant === 'B' && <VariantB h={home} />}
      </main>
      <SiteFooter />
      {bar}
    </>
  )
}
