// The team report card, /jazz/<game-slug> (docs/plans/jazz-first-site.md;
// the layout chosen 2026-10-14 from the three-variant prototype: C, Season
// context, with B's side-by-side opponent rows and the prior season behind
// the quadrant; restyled 2026-10-29 by a second prototype, ADR-0094: the
// poster banner and numbered acts). In order: the poster banner with the
// score and the night's title (the game's own photograph when one is on
// file, the typographic poster otherwise); 01 the quadrant with the two
// answers beside it; 02 both teams' courts over one zone-count table; 03
// both sides on the same terms; 04 the players; the ruler in one line.
//
// A tool page: every number is reportCard.ts's (aggregateShotMetrics over
// persisted rows), every displayed gap subtracts its displayed anchors
// (ADR-0023), structural copy comes from REPORT_COPY, and every directional
// word from the computed-copy registry, decided on the displayed gap so the
// words can never disagree with the number beside them. No small-sample
// flag at game grain (ADR-0086's stance); the attempt count sits beside
// every value instead.

import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { GameQuadrant } from '../chart/GameQuadrant'
import { ShotChart } from '../chart/ShotChart'
import type { GamePayload } from '../domain/gamePayload'
import { buildReportCard } from '../domain/reportCard'
import type { ReportCard, SideCard } from '../domain/reportCard'
import type { TeamSeasonIndex } from '../domain/teamSeasonIndex'
import type { TeamShotPayload } from '../domain/teamShotPayload'
import {
  displayGapUnits,
  formatGameDate,
  formatMatchup,
  formatPercent1,
  formatPps2,
  formatSignedGap,
} from '../format'
import {
  AUTHORED,
  makingAnswer,
  nightTitle,
  QUESTIONS,
  rankLine,
  selectionAnswer,
} from '../teams/computedCopy'
import { REPORT_COPY } from '../teams/copy'
import type { TeamConfig } from '../teams/registry'
import {
  gamePayloadUrl,
  teamGameUrl,
  teamLogoUrl,
  teamPageUrl,
  teamSeasonIndexUrl,
  teamSeasonUrl,
  teamShotPayloadUrl,
} from '../teams/urls'
import { PosterBanner } from './PosterBanner'
import { displayedGaps, gameBannerArt } from './reportCardDisplay'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import type { TeamRoute } from './teamRoute'
import { TeamPageError } from './TeamPage'
import {
  useOptionalGamePayload,
  useOptionalTeamSeasonIndex,
  useOptionalTeamShotPayload,
} from './usePayload'

type GameRoute = Extract<TeamRoute, { kind: 'game' | 'gameId' }>

function priorSeasonOf(season: string): string {
  const start = Number(season.slice(0, 4)) - 1
  return `${start}-${String(start + 1).slice(-2)}`
}

export function ReportCardPage({ team, route }: { team: TeamConfig; route: GameRoute }) {
  const segment = route.kind === 'game' ? route.slug : route.gameId
  const known = team.seasons.includes(route.season)
  const prior = priorSeasonOf(route.season)
  const hasPrior = known && team.seasons.includes(prior)
  const indexState = useOptionalTeamSeasonIndex(known ? teamSeasonIndexUrl(team, route.season) : null)
  const payloadState = useOptionalTeamShotPayload(known ? teamShotPayloadUrl(team, route.season) : null)
  const priorIndexState = useOptionalTeamSeasonIndex(hasPrior ? teamSeasonIndexUrl(team, prior) : null)
  const priorPayloadState = useOptionalTeamShotPayload(hasPrior ? teamShotPayloadUrl(team, prior) : null)
  const row =
    indexState.status === 'ready'
      ? indexState.payload.games.find((g) => (route.kind === 'game' ? g.slug === route.slug : g.gameId === route.gameId))
      : undefined
  const gameState = useOptionalGamePayload(row ? gamePayloadUrl(team, route.season, row.gameId) : null)

  if (!known) return <TeamPageError message={REPORT_COPY.seasonNotOnFile(team.name, segment)} />
  for (const state of [indexState, payloadState, priorIndexState, priorPayloadState, gameState]) {
    if (state.status === 'error') return <TeamPageError message={state.message} />
  }
  if (indexState.status === 'ready' && row === undefined) {
    return <TeamPageError message={REPORT_COPY.noSuchGame(team.name, segment)} />
  }
  if (
    indexState.status !== 'ready' ||
    payloadState.status !== 'ready' ||
    gameState.status !== 'ready' ||
    priorIndexState.status === 'loading' ||
    priorPayloadState.status === 'loading'
  ) {
    return (
      <main className="hero-page team-page">
        <SiteNav />
        <p className="page-status page-loading">Loading game data…</p>
      </main>
    )
  }
  const priorData =
    priorIndexState.status === 'ready' && priorPayloadState.status === 'ready'
      ? { index: priorIndexState.payload, payload: priorPayloadState.payload }
      : undefined
  return (
    <CardReady
      team={team}
      game={gameState.payload}
      index={indexState.payload}
      payload={payloadState.payload}
      prior={priorData}
    />
  )
}

function Draft() {
  return AUTHORED ? null : <span className="draft-tag">{REPORT_COPY.draftTag}</span>
}

function CardReady({
  team,
  game,
  index,
  payload,
  prior,
}: {
  team: TeamConfig
  game: GamePayload
  index: TeamSeasonIndex
  payload: TeamShotPayload
  prior?: { index: TeamSeasonIndex; payload: TeamShotPayload }
}) {
  const card = useMemo(() => buildReportCard(game, index, payload, prior), [game, index, payload, prior])
  const { subject, opponent } = card
  const gaps = displayedGaps(subject.metrics)
  const date = formatGameDate(card.gameDate)
  const matchup = formatMatchup(opponent.tricode, subject.home)
  const score = `${card.won ? 'W' : 'L'} ${subject.score}–${opponent.score}`
  const seasonUrl = card.season === team.canonicalSeason ? teamPageUrl(team) : teamSeasonUrl(team, card.season)

  useEffect(() => {
    document.title = `${team.name} ${score} ${matchup} · ${date}`
  }, [team, score, matchup, date])

  const { art, credit } = gameBannerArt(card.slug)
  const sides = [subject, opponent] as const

  return (
    <>
      <main className="hero-page team-page report-card">
        <SiteNav />
        <PosterBanner
          art={art}
          logoUrl={teamLogoUrl(team)}
          kicker={REPORT_COPY.kicker(team.name, date, matchup)}
          title={<GameTitle score={score} night={nightTitle(gaps.selection, gaps.making)} />}
          cue={REPORT_COPY.cue}
          credit={credit}
          className="game-poster"
        />
        <p className="team-note report-back">
          <a href={seasonUrl}>← {REPORT_COPY.backToSeason(card.season)}</a>
        </p>

        {/* The acts, numbered like an argument's (the 2026-10-29 prototype's
            C), each a visual beside or above its data twin. */}
        <section className="report-section report-first" aria-labelledby="report-quadrant-caption">
          <ActHeader
            id="report-quadrant-caption"
            kicker={REPORT_COPY.actNight}
            title={REPORT_COPY.quadrantCaption}
            desc={REPORT_COPY.quadrantDesc}
          />
          <div className="report-lead">
            <GameQuadrant
              dots={card.dots}
              tonight={card.tonight}
              priorDots={card.priorDots}
              season={card.season}
              priorSeason={card.priorSeason}
              hrefOf={(d) => teamGameUrl(team, d.slug)}
              ariaLabel={`Every ${team.name} game so far, shot diet against conversion`}
            />
            <Answers card={card} gaps={gaps} />
          </div>
        </section>

        <section className="report-section" aria-labelledby="report-court-caption">
          <ActHeader
            id="report-court-caption"
            kicker={REPORT_COPY.actFloors}
            title={REPORT_COPY.courtCaption}
            desc={REPORT_COPY.courtDesc}
          />
          <div className="report-courts">
            {sides.map((side, i) => (
              <figure key={side.tricode} className="report-court">
                <figcaption>{side.tricode}</figcaption>
                <ShotChart
                  shots={game.sides[i].shots}
                  ariaLabel={`Half-court shot chart: ${side.team} shots, ${date} ${matchup}`}
                />
              </figure>
            ))}
          </div>
          <ZoneCounts subject={subject} opponent={opponent} />
        </section>

        <section className="report-section" aria-labelledby="report-sides-caption">
          <ActHeader
            id="report-sides-caption"
            kicker={REPORT_COPY.actTerms}
            title={REPORT_COPY.sidesCaption}
            desc={REPORT_COPY.sidesDesc}
          />
          <BothSides subject={subject} opponent={opponent} />
        </section>

        <section className="report-section" aria-labelledby="report-players-caption">
          <ActHeader
            id="report-players-caption"
            kicker={REPORT_COPY.actPlayers}
            title={REPORT_COPY.playersCaption}
            desc={REPORT_COPY.playersDesc(team.name)}
          />
          <Players side={subject} />
        </section>

        <p className="report-ruler">
          {card.ruler.kind === 'pre-game'
            ? REPORT_COPY.rulerPreGame(formatGameDate(card.ruler.through), card.ruler.games.toLocaleString('en-US'))
            : REPORT_COPY.rulerPriorSeason(card.ruler.season, card.ruler.games.toLocaleString('en-US'))}
        </p>
      </main>
      <SiteFooter directoryLink />
    </>
  )
}

/** An act's header: the hero page's recipe (ADR-0051), a numbered kicker
 * over the caps title over the gray description, the kicker and description
 * outside the h2 so the heading's name is the title alone. */
function ActHeader({ id, kicker, title, desc }: { id: string; kicker: string; title: string; desc: string }) {
  return (
    <header className="section-caption">
      <p className="section-kicker">{kicker}</p>
      <h2 id={id}>{title}</h2>
      <p className="section-caption-desc">{desc}</p>
    </header>
  )
}

/** The poster's h1: the score at poster scale over the night's title. The
 * " · " between them stays in the heading's text (one sentence to a reader
 * that hears it) and is never drawn: the line break does its work. */
function GameTitle({ score, night }: { score: string; night: string }) {
  return (
    <>
      <span className="poster-score">{score}</span>
      <span className="poster-sep"> · </span>
      <span className="poster-night">
        {night}
        <Draft />
      </span>
    </>
  )
}

function Answer({
  question,
  number,
  words,
  anchors,
  rank,
}: {
  question: string
  number: string
  words: string
  anchors: ReactNode
  rank: string | null
}) {
  return (
    <div className="answer">
      <h2 className="answer-question">{question}</h2>
      <p className="answer-number">{number}</p>
      <p className="answer-words">
        {words}
        <Draft />
      </p>
      <p className="answer-anchors">{anchors}</p>
      {rank !== null && (
        <p className="answer-rank">
          {rank}
          <Draft />
        </p>
      )}
    </div>
  )
}

function Answers({ card, gaps }: { card: ReportCard; gaps: { selection: number; making: number } }) {
  const m = card.subject.metrics
  const priced = REPORT_COPY.pricedShots(m.evalAttempts)
  const heaves = m.backcourt.attempts
  const conflicts = card.subject.zoneConflicts
  return (
    <aside className="report-answers">
      <Answer
        question={QUESTIONS.selection}
        number={formatSignedGap(m.selection.playerDietExpectedPps, m.selection.leagueDietExpectedPps, 2)}
        words={selectionAnswer(gaps.selection)}
        anchors={
          <>
            <span className="anchor">{formatPps2(m.selection.playerDietExpectedPps)}</span> {REPORT_COPY.dietAnchor} ·{' '}
            <span className="anchor">{formatPps2(m.selection.leagueDietExpectedPps)}</span> {REPORT_COPY.leagueDietAnchor} ·{' '}
            {priced}
          </>
        }
        rank={card.ranks ? rankLine('selection', card.ranks.selection, card.ranks.games) : null}
      />
      <Answer
        question={QUESTIONS.making}
        number={formatSignedGap(m.making.actualPps, m.selection.playerDietExpectedPps, 2)}
        words={makingAnswer(gaps.making)}
        anchors={
          <>
            <span className="anchor">{formatPps2(m.making.actualPps)}</span> {REPORT_COPY.scoredAnchor} ·{' '}
            <span className="anchor">{formatPps2(m.selection.playerDietExpectedPps)}</span> {REPORT_COPY.expectedAnchor} ·{' '}
            {priced}
          </>
        }
        rank={card.ranks ? rankLine('making', card.ranks.making, card.ranks.games) : null}
      />
      {(heaves > 0 || conflicts > 0) && <p className="answer-note">{REPORT_COPY.unpriced(heaves, conflicts)}</p>}
    </aside>
  )
}

/** Both teams' makes and attempts per zone: counts only, never shading (one
 * game is too few shots for a zone reading, ADR-0084). The Backcourt row
 * appears when either side took a heave. */
function ZoneCounts({ subject, opponent }: { subject: SideCard; opponent: SideCard }) {
  const count = (s: { makes: number; attempts: number }) => `${s.makes}–${s.attempts}`
  const zoneOf = (side: SideCard, zone: string) => side.metrics.zones.find((r) => r.zone === zone)!
  return (
    <div className="table-panel report-zones">
      <table className="zone-table report-table" aria-label="Makes and attempts per zone, both teams">
        <thead>
          <tr>
            <th scope="col">Zone</th>
            <th scope="col">
              {subject.tricode}
              <span className="cell-sub">FGM–FGA</span>
            </th>
            <th scope="col">
              {opponent.tricode}
              <span className="cell-sub">FGM–FGA</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {subject.metrics.zones.map((z) => (
            <tr key={z.zone}>
              <th scope="row">{z.zone}</th>
              <td>{count(z)}</td>
              <td>{count(zoneOf(opponent, z.zone))}</td>
            </tr>
          ))}
          {(subject.metrics.backcourt.attempts > 0 || opponent.metrics.backcourt.attempts > 0) && (
            <tr>
              <th scope="row">Backcourt</th>
              <td>{count(subject.metrics.backcourt)}</td>
              <td>{count(opponent.metrics.backcourt)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

interface SidesRow {
  label: string
  cells: [ReactNode, ReactNode]
  /** Display units of each side, where a higher value is the edge; absent
   * on shares, which have no better direction. */
  edge?: [number, number]
}

function trips(side: SideCard): string {
  const parts = [
    side.line.shooting ? `${side.line.shooting} shooting` : '',
    side.line.bonus ? `${side.line.bonus} bonus` : '',
    side.line.andOne ? `${side.line.andOne} and-1` : '',
    side.line.other ? `${side.line.other} other` : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

function BothSides({ subject, opponent }: { subject: SideCard; opponent: SideCard }) {
  // An anchor's own display units: its gap from zero (ADR-0023's currency),
  // so a mark never lands between two values that display alike.
  const units = (x: number | null) => displayGapUnits(x, 0, 2) ?? 0
  const pair = <T,>(f: (s: SideCard) => T): [T, T] => [f(subject), f(opponent)]
  const rows: SidesRow[] = [
    {
      label: REPORT_COPY.rowDiet,
      cells: pair((s) => formatPps2(s.metrics.selection.playerDietExpectedPps)),
      edge: pair((s) => units(s.metrics.selection.playerDietExpectedPps)),
    },
    {
      label: REPORT_COPY.rowScored,
      cells: pair((s) => formatPps2(s.metrics.making.actualPps)),
      edge: pair((s) => units(s.metrics.making.actualPps)),
    },
    {
      label: REPORT_COPY.rowConversion,
      cells: pair((s) => formatSignedGap(s.metrics.making.actualPps, s.metrics.selection.playerDietExpectedPps, 2)),
      edge: pair((s) => displayGapUnits(s.metrics.making.actualPps, s.metrics.selection.playerDietExpectedPps, 2)!),
    },
    { label: REPORT_COPY.rowRim, cells: pair((s) => formatPercent1(s.shares.rim)) },
    { label: REPORT_COPY.rowThrees, cells: pair((s) => formatPercent1(s.shares.threes)) },
    { label: REPORT_COPY.rowMid, cells: pair((s) => formatPercent1(s.shares.mid)) },
    {
      label: REPORT_COPY.rowTrips,
      cells: pair((s) => (
        <>
          {s.line.trips}
          {s.line.trips > 0 && <span className="cell-sub">{trips(s)}</span>}
        </>
      )),
    },
    {
      label: REPORT_COPY.rowFtPoints,
      cells: pair((s) => (
        <>
          {s.line.ftm}
          <span className="cell-sub">
            {s.line.ftm}–{s.line.fta} FT
            {s.line.technicalFtm > 0 ? ` · ${s.line.technicalFtm} technical` : ''}
          </span>
        </>
      )),
      edge: pair((s) => s.line.ftm),
    },
    {
      label: REPORT_COPY.rowCredit,
      cells: pair((s) => (
        <>
          {formatPercent1(s.credit.makes > 0 ? s.credit.assisted / s.credit.makes : null)}
          <span className="cell-sub">
            {s.credit.assisted} of {s.credit.makes} makes
            {s.credit.unknown > 0 ? ` · ${s.credit.unknown} unknown` : ''}
          </span>
        </>
      )),
    },
  ]
  return (
    <div className="table-panel">
      <div className="zone-scroll">
        <table className="zone-table report-table report-sides" aria-label="Both teams on the same terms">
          <thead>
            <tr>
              <th scope="col">
                {subject.tricode}
                <span className="cell-sub">{REPORT_COPY.pricedShots(subject.metrics.evalAttempts)}</span>
              </th>
              <th scope="col">
                <span className="visually-hidden">Measure</span>
              </th>
              <th scope="col">
                {opponent.tricode}
                <span className="cell-sub">{REPORT_COPY.pricedShots(opponent.metrics.evalAttempts)}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const lead = r.edge && r.edge[0] !== r.edge[1] ? (r.edge[0] > r.edge[1] ? 0 : 1) : null
              return (
                <tr key={r.label}>
                  <td className={lead === 0 ? 'edge' : undefined}>{r.cells[0]}</td>
                  <th scope="row">{r.label}</th>
                  <td className={lead === 1 ? 'edge' : undefined}>{r.cells[1]}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="table-note">{REPORT_COPY.sidesNote}</p>
    </div>
  )
}

function Players({ side }: { side: SideCard }) {
  return (
    <div className="table-panel">
      <div className="zone-scroll">
        <table className="zone-table report-table" aria-label="Each player’s night">
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">PTS</th>
              <th scope="col">FG</th>
              <th scope="col">FT</th>
              <th scope="col">Trips</th>
              <th scope="col">Expected</th>
              <th scope="col">Scored</th>
              <th scope="col">Conversion</th>
            </tr>
          </thead>
          <tbody>
            {side.players.map((p) => (
              <tr key={p.playerId}>
                <th scope="row">{p.name}</th>
                <td>{p.points}</td>
                <td>
                  {p.fgm}–{p.fga}
                </td>
                <td>
                  {p.ftm}–{p.fta}
                </td>
                <td>{p.trips}</td>
                <td>{p.expected === null ? '—' : p.expected.toFixed(1)}</td>
                <td>{p.scored === null ? '—' : p.scored.toFixed(0)}</td>
                <td>{formatSignedGap(p.scored, p.expected, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-note">{REPORT_COPY.playersNote}</p>
    </div>
  )
}
