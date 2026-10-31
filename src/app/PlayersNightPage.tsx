// A player's night, /jazz/<game-slug>/<player-slug> (docs/plans/jazz-home-
// transition.md, Stage 4; ADR-0096; the layout chosen 2026-10-31 from the
// two-variant prototype: B, Composite). In order: his headshot banner; the
// byline (the result and his box line, up to his season page and across to
// the game's report card); one poster block holding the two answers and the
// two chips beside his court, with the receipt as a drill-in inside it; his
// season so far on the quadrant, this game ringed; the ruler in one line.
//
// A tool page: every number is playersNight.ts's, every displayed gap
// subtracts its displayed anchors (ADR-0023), structural copy comes from
// NIGHT_COPY, and every directional word from the report card's computed-
// copy registry at player grain, decided on the displayed gap. No
// small-sample flag at game grain (ADR-0086's stance); the attempt count
// sits beside every value instead.

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { GameQuadrant } from '../chart/GameQuadrant'
import { ShotChart } from '../chart/ShotChart'
import type { GamePayload } from '../domain/gamePayload'
import { seasonShooters } from '../domain/playerSeason'
import { buildPlayersNight } from '../domain/playersNight'
import type { PlayersNight, ReceiptLine } from '../domain/playersNight'
import type { TeamSeasonIndex } from '../domain/teamSeasonIndex'
import type { TeamShotPayload } from '../domain/teamShotPayload'
import { formatGameDate, formatMatchup, formatPercent1, formatPeriod, formatPps2, formatSignedGap } from '../format'
import { makingAnswer, QUESTIONS, selectionAnswer } from '../teams/computedCopy'
import { NIGHT_COPY, NIGHT_TRIP_COUNTS, NIGHT_TRIP_LABELS, NIGHT_ZONE_LABELS, REPORT_COPY } from '../teams/copy'
import type { TeamConfig } from '../teams/registry'
import {
  gamePayloadUrl,
  playerHeadshotUrl,
  teamGameUrl,
  teamNightUrl,
  teamPlayerUrl,
  teamSeasonIndexUrl,
  teamShotPayloadUrl,
} from '../teams/urls'
import { PosterBanner } from './PosterBanner'
import { displayedGaps } from './reportCardDisplay'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import type { TeamRoute } from './teamRoute'
import { TeamPageError } from './TeamPage'
import { Term } from './Term'
import { useOptionalGamePayload, useOptionalTeamSeasonIndex, useOptionalTeamShotPayload } from './usePayload'

type NightRoute = Extract<TeamRoute, { kind: 'night' }>

function priorSeasonOf(season: string): string {
  const start = Number(season.slice(0, 4)) - 1
  return `${start}-${String(start + 1).slice(-2)}`
}

export function PlayersNightPage({ team, route }: { team: TeamConfig; route: NightRoute }) {
  const known = team.seasons.includes(route.season)
  const prior = priorSeasonOf(route.season)
  const hasPrior = known && team.seasons.includes(prior)
  const indexState = useOptionalTeamSeasonIndex(known ? teamSeasonIndexUrl(team, route.season) : null)
  const payloadState = useOptionalTeamShotPayload(known ? teamShotPayloadUrl(team, route.season) : null)
  const priorIndexState = useOptionalTeamSeasonIndex(hasPrior ? teamSeasonIndexUrl(team, prior) : null)
  const priorPayloadState = useOptionalTeamShotPayload(hasPrior ? teamShotPayloadUrl(team, prior) : null)
  const row = indexState.status === 'ready' ? indexState.payload.games.find((g) => g.slug === route.game) : undefined
  const gameState = useOptionalGamePayload(row ? gamePayloadUrl(team, route.season, row.gameId) : null)

  if (!known) return <TeamPageError message={REPORT_COPY.seasonNotOnFile(team.name, route.game)} />
  for (const state of [indexState, payloadState, priorIndexState, priorPayloadState, gameState]) {
    if (state.status === 'error') return <TeamPageError message={state.message} />
  }
  if (indexState.status === 'ready' && row === undefined) {
    return <TeamPageError message={REPORT_COPY.noSuchGame(team.name, route.game)} />
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
    <NightReady
      team={team}
      route={route}
      game={gameState.payload}
      index={indexState.payload}
      payload={payloadState.payload}
      prior={priorData}
    />
  )
}

function NightReady({
  team,
  route,
  game,
  index,
  payload,
  prior,
}: {
  team: TeamConfig
  route: NightRoute
  game: GamePayload
  index: TeamSeasonIndex
  payload: TeamShotPayload
  prior?: { index: TeamSeasonIndex; payload: TeamShotPayload }
}) {
  const night = useMemo(
    () => buildPlayersNight(route.slug, game, index, payload, prior),
    [route.slug, game, index, payload, prior],
  )
  const title = night === null ? null : `${night.player.name} · ${formatGameDate(night.gameDate)} · ${team.name}`

  useEffect(() => {
    if (title !== null) document.title = title
  }, [title])

  if (night === null) {
    // Not in this game's box: his season page, when he has one, is the
    // nearest page about him (the plan's route default).
    const shooter = seasonShooters(payload).find((p) => p.slug === route.slug)
    return (
      <TeamPageError
        message={NIGHT_COPY.notInBox(team.name, route.slug, route.game)}
        link={
          shooter === undefined
            ? undefined
            : { href: teamPlayerUrl(team, route.season, shooter.slug), label: NIGHT_COPY.seasonLink(route.season) }
        }
      />
    )
  }
  return <NightPage team={team} night={night} />
}

function NightPage({ team, night }: { team: TeamConfig; night: PlayersNight }) {
  const { line, player } = night
  const date = formatGameDate(night.gameDate)
  const matchup = formatMatchup(night.opponent, night.home)
  const attempted = line.fga + line.fta > 0
  const priced = night.metrics !== null && night.evalAttempts > 0
  const chart = night.hasSeasonPage && night.dots.length > 0

  return (
    <>
      <main className="hero-page team-page player-season players-night">
        <SiteNav />
        <PosterBanner
          art={{ kind: 'headshot', src: playerHeadshotUrl(player.slug) }}
          logoUrl={null}
          kicker={REPORT_COPY.kicker(team.name, date, matchup)}
          title={player.name}
          cue={NIGHT_COPY.cue}
          className="player-poster"
        />
        <header className="player-header">
          <p className="hero-byline">
            {night.won ? 'W' : 'L'} {night.teamScore}–{night.opponentScore} · {line.points} pts · {line.fgm}–{line.fga} FG ·{' '}
            {line.tpm}–{line.tpa} 3P · {line.ftm}–{line.fta} FT · {line.reb} reb · {line.ast} ast · {line.minutes} min
          </p>
          <p className="team-note player-links">
            {night.hasSeasonPage && (
              <>
                <a href={teamPlayerUrl(team, night.season, player.slug)}>← {NIGHT_COPY.seasonLink(night.season)}</a>
                {' · '}
              </>
            )}
            <a href={teamGameUrl(team, night.slug)}>{NIGHT_COPY.cardLink} →</a>
          </p>
        </header>

        <section className="night-poster" aria-label={NIGHT_COPY.posterLabel}>
          {!attempted ? (
            <p className="team-note">{NIGHT_COPY.noAttempt}</p>
          ) : (
            <>
              <div className="night-grid">
                <div className="night-answers">
                  {priced ? <Answers night={night} /> : <p className="team-note">{NIGHT_COPY.noPricedShot}</p>}
                  <Chips night={night} />
                </div>
                {night.shots.length > 0 && (
                  <figure className="night-court">
                    <ShotChart
                      shots={night.shots}
                      ariaLabel={`Half-court shot chart: ${night.shots.length} shots by ${player.name}, ${date} ${matchup}`}
                    />
                  </figure>
                )}
              </div>
              <Receipt night={night} />
            </>
          )}
        </section>

        <section className="report-section night-season" aria-labelledby="night-season-caption">
          <h2 className="night-caption" id="night-season-caption">
            {NIGHT_COPY.seasonCaption(night.season)}
          </h2>
          {!night.hasSeasonPage ? (
            <p className="team-note">{NIGHT_COPY.noSeasonPage}</p>
          ) : !chart ? (
            <p className="team-note">{NIGHT_COPY.quadrantEmpty}</p>
          ) : (
            <>
              {night.tonight === null && <p className="team-note">{NIGHT_COPY.quadrantNoDot}</p>}
              <div className="player-quadrant">
                <GameQuadrant
                  dots={night.dots}
                  tonight={night.tonight}
                  priorDots={night.priorDots}
                  season={night.season}
                  priorSeason={night.priorSeason}
                  hrefOf={(d) => teamNightUrl(team, d.slug, player.slug)}
                  ariaLabel={NIGHT_COPY.quadrantAria(team.name, player.name)}
                  opens={NIGHT_COPY.opens}
                />
              </div>
            </>
          )}
        </section>

        {(priced || chart) && (
          <p className="report-ruler">
            {priced &&
              (night.ruler.kind === 'pre-game'
                ? REPORT_COPY.rulerPreGame(formatGameDate(night.ruler.through), night.ruler.games.toLocaleString('en-US'))
                : REPORT_COPY.rulerPriorSeason(night.ruler.season, night.ruler.games.toLocaleString('en-US')))}
            {priced && chart && ' '}
            {chart && REPORT_COPY.rulerDots}
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  )
}

function Answer({ question, number, words, anchors }: { question: string; number: string; words: string; anchors: ReactNode }) {
  return (
    <div className="answer">
      <h2 className="answer-question">{question}</h2>
      <p className="answer-number">{number}</p>
      <p className="answer-words">{words}</p>
      <p className="answer-anchors">{anchors}</p>
    </div>
  )
}

function Answers({ night }: { night: PlayersNight }) {
  const m = night.metrics!
  const gaps = displayedGaps(m)
  const priced = REPORT_COPY.pricedShots(m.evalAttempts)
  return (
    <>
      <Answer
        question={QUESTIONS.selection}
        number={formatSignedGap(m.selection.playerDietExpectedPps, m.selection.leagueDietExpectedPps, 2)}
        words={selectionAnswer(gaps.selection)}
        anchors={
          <>
            <span className="anchor">{formatPps2(m.selection.playerDietExpectedPps)}</span> {NIGHT_COPY.dietAnchor} ·{' '}
            <span className="anchor">{formatPps2(m.selection.leagueDietExpectedPps)}</span> {REPORT_COPY.leagueDietAnchor} ·{' '}
            {priced}
          </>
        }
      />
      <Answer
        question={QUESTIONS.making}
        number={formatSignedGap(m.making.actualPps, m.selection.playerDietExpectedPps, 2)}
        words={makingAnswer(gaps.making)}
        anchors={
          <>
            <span className="anchor">{formatPps2(m.making.actualPps)}</span> {REPORT_COPY.scoredAnchor} ·{' '}
            <span className="anchor">{formatPps2(m.selection.playerDietExpectedPps)}</span> {NIGHT_COPY.expectedAnchor} ·{' '}
            {priced}
          </>
        }
      />
      {(night.heaves > 0 || night.zoneConflicts > 0) && (
        <p className="answer-note">{REPORT_COPY.unpriced(night.heaves, night.zoneConflicts)}</p>
      )}
    </>
  )
}

/** THE LINE and THE CREDIT: counts, never priced (decision 3). */
function Chips({ night }: { night: PlayersNight }) {
  const { line, trips, credit } = night
  const classes = trips.byClass.map((c) => NIGHT_TRIP_COUNTS[c.tripClass](c.count)).join(', ')
  return (
    <div className="night-chips">
      <p>
        <b>{NIGHT_COPY.lineLabel}</b> {trips.points} pts on {trips.count}{' '}
        <Term id="trip">{trips.count === 1 ? 'trip' : 'trips'}</Term>
        {trips.count > 0 && ` (${classes})`} · {line.ftm}–{line.fta} FT · <Term id="fta-rate">FTA rate</Term>{' '}
        {formatPercent1(line.fga > 0 ? line.fta / line.fga : null)}
        {line.technicalFta > 0 && ` · ${line.technicalFtm}–${line.technicalFta} technical`}
      </p>
      <p>
        <b>{NIGHT_COPY.creditLabel}</b>{' '}
        {credit.makes === 0
          ? NIGHT_COPY.noMakes
          : `${credit.assisted} assisted · ${credit.unassisted} unassisted${credit.unknown > 0 ? ` · ${credit.unknown} unknown` : ''}`}
      </p>
    </div>
  )
}

const clockOf = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

function points(value: number) {
  return <td className={value > 0 ? 'night-made' : 'night-miss'}>{value > 0 ? `+${value}` : '0'}</td>
}

function ReceiptRow({ r }: { r: ReceiptLine }) {
  const when = (
    <td className="night-when">
      {formatPeriod(r.period)} {clockOf(r.clock)}
    </td>
  )
  if (r.kind === 'shot') {
    const s = r.shot
    return (
      <tr className={r.price === null ? 'night-unpriced' : undefined}>
        {when}
        <td>
          {NIGHT_ZONE_LABELS[s.zoneBasic]}
          {s.made && <span className="night-assist"> · {s.assistStatus}</span>}
        </td>
        <td className="night-price">{r.price === null ? '—' : r.price.toFixed(2)}</td>
        {points(s.made ? s.pointValue : 0)}
      </tr>
    )
  }
  if (r.kind === 'conflict') {
    return (
      <tr className="night-unpriced">
        {when}
        <td>{NIGHT_COPY.conflictLine(r.pointValue, NIGHT_ZONE_LABELS[r.zone])}</td>
        <td className="night-price">—</td>
        {points(r.made ? r.pointValue : 0)}
      </tr>
    )
  }
  return (
    <tr>
      {when}
      <td>
        {NIGHT_TRIP_LABELS[r.trip.tripClass]} · {r.trip.ftm}–{r.trip.fta} FT
      </td>
      <td className="night-price" />
      {points(r.trip.ftm)}
    </tr>
  )
}

/** Every attempt and trip in game order down to his box points (the game
 * file's receipt identity, re-asserted at its load boundary). */
function Receipt({ night }: { night: PlayersNight }) {
  const [open, setOpen] = useState(false)
  const { line } = night
  const extra = [
    { fta: line.splitFta, ftm: line.splitFtm, label: NIGHT_COPY.splitLine },
    { fta: line.technicalFta, ftm: line.technicalFtm, label: NIGHT_COPY.technicalLine },
  ].filter((x) => x.fta > 0)
  return (
    <>
      <button type="button" className="night-drill" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? NIGHT_COPY.drillClose : NIGHT_COPY.drillOpen(night.receipt.length + extra.length)}
      </button>
      {open && (
        <div className="night-receipt">
          <table>
            <caption className="visually-hidden">{NIGHT_COPY.receiptCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{NIGHT_COPY.colTime}</th>
                <th scope="col">{NIGHT_COPY.colEvent}</th>
                <th scope="col">{NIGHT_COPY.colExpected}</th>
                <th scope="col">{NIGHT_COPY.colPoints}</th>
              </tr>
            </thead>
            <tbody>
              {night.receipt.map((r, i) => (
                <ReceiptRow key={i} r={r} />
              ))}
              {extra.map((x) => (
                <tr key={x.label}>
                  <td />
                  <td>
                    {x.label} · {x.ftm}–{x.fta} FT
                  </td>
                  <td className="night-price" />
                  {points(x.ftm)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              {night.expected !== null && (
                <tr className="night-subtotal">
                  <td colSpan={2}>{NIGHT_COPY.pricedSubtotal(night.evalAttempts)}</td>
                  <td>{night.expected.toFixed(1)}</td>
                  <td>{night.scored!.toFixed(0)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={3}>{NIGHT_COPY.gameTotal}</td>
                <td>{line.points}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
