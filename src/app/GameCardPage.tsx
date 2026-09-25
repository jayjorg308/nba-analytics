// A game card (ADR-0086): one player's night as priced facts — the poster
// (expected from his diet, scored, conversion) over LINE and CREDIT chips,
// with the receipt as a drill-in itemizing the night in game order: shots
// and trips interleaved by period and clock, each priced at league rates
// (league PPS by zone for shots, league FT conversion for trips), down to
// the box total. A tool, not an argument: computed numbers and structural
// copy only; conversion is what happened, never an ability estimate, so
// nothing here is flagged or graded. State is owned by the path
// (/game/<slug>/<date>); the whole data need is one game-log payload.

import { useEffect, useState } from 'react'
import type { EvalZone } from '../domain/constants'
import type { GameCardNumbers } from '../domain/gameCard'
import { computeGameCard } from '../domain/gameCard'
import type { CardGame, GameLogPayload } from '../domain/gameLogPayload'
import { shotPrices } from '../domain/gameLogPayload'
import { formatGameDate, formatPercent1, formatPeriod } from '../format'
import { heroBySlug } from '../heroes/registry'
import { gameCardUrl, gameLandingUrl, gameLogUrl, heroPageUrl } from '../heroes/urls'
import { seasonOfGameDate } from './routes'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import { Term } from './Term'
import { useGameLogPayload } from './usePayload'

const ZONE_SHORT: Record<string, string> = {
  'Restricted Area': 'Restricted Area',
  'In The Paint (Non-RA)': 'Paint (non-RA)',
  'Mid-Range': 'Mid-Range',
  'Left Corner 3': 'Left Corner 3',
  'Right Corner 3': 'Right Corner 3',
  'Above the Break 3': 'Above the Break 3',
  Backcourt: 'Backcourt',
}

const TRIP_LABEL: Record<string, string> = {
  shootingFoul2: 'shooting foul',
  shootingFoul3: 'shooting foul',
  bonus: 'bonus',
  andOne: 'and-1',
  flagrant: 'flagrant',
  awayFromPlay: 'away from play',
  transitionTake: 'transition take',
  clearPath: 'clear path',
  fouledDuringMake: 'fouled during a make',
}

const signed = (n: number) => (n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1))

/** Seconds remaining in the period, for game-order sorting (clock counts
 * down, so later events have smaller values). */
const clockSeconds = (clock: string) => {
  const [m, s] = clock.split(':')
  return Number(m) * 60 + Number(s)
}

type ReceiptRow =
  | { kind: 'shot'; period: number; clock: string; shot: CardGame['shots'][number] }
  | { kind: 'trip'; period: number; clock: string; trip: CardGame['trips'][number] }

/** The night in game order: shots and trips merged by period and clock. The
 * sort is stable and shots stage first, so an and-one's single free throw
 * lands directly under its made shot (they share a clock). */
function receiptRows(game: CardGame): ReceiptRow[] {
  const rows: ReceiptRow[] = [
    ...game.shots.map((shot) => ({
      kind: 'shot' as const,
      period: shot.period,
      clock: shot.clock,
      shot,
    })),
    ...game.trips.map((trip) => ({
      kind: 'trip' as const,
      period: trip.period,
      clock: trip.clock,
      trip,
    })),
  ]
  return rows.sort(
    (a, b) => a.period - b.period || clockSeconds(b.clock) - clockSeconds(a.clock),
  )
}

function Receipt({ game, numbers }: { game: CardGame; numbers: GameCardNumbers }) {
  return (
    <div className="gamecard-receipt">
      <table>
        <caption className="visually-hidden">
          The night in game order: every attempt and trip, priced at league rates
        </caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Event</th>
            <th scope="col">Exp (lg)</th>
            <th scope="col">Pts</th>
          </tr>
        </thead>
        <tbody>
          {receiptRows(game).map((row, i) => {
            if (row.kind === 'shot') {
              const priced = shotPrices(row.shot)
              return (
                <tr key={i} className={priced ? undefined : 'gamecard-unpriced'}>
                  <td>{formatPeriod(row.period)}</td>
                  <td>{ZONE_SHORT[row.shot.zone] ?? row.shot.zone}</td>
                  <td className="gamecard-price">
                    {priced ? numbers.leaguePps[row.shot.zone as EvalZone].toFixed(2) : '—'}
                  </td>
                  <td className={row.shot.made ? 'gamecard-made' : 'gamecard-miss'}>
                    {row.shot.made ? `+${row.shot.value}` : '0'}
                  </td>
                </tr>
              )
            }
            return (
              <tr key={i}>
                <td>{formatPeriod(row.period)}</td>
                <td>
                  {TRIP_LABEL[row.trip.tripClass]} · {row.trip.ftm}/{row.trip.fta} FT
                </td>
                <td className="gamecard-price">
                  {(row.trip.fta * numbers.leagueFtPct).toFixed(2)}
                </td>
                <td className={row.trip.ftm > 0 ? 'gamecard-made' : 'gamecard-miss'}>
                  {row.trip.ftm > 0 ? `+${row.trip.ftm}` : '0'}
                </td>
              </tr>
            )
          })}
          {game.splitFta > 0 && (
            <tr>
              <td />
              <td>
                <Term id="split-trip">split trip</Term> free throws · {game.splitFtm}/
                {game.splitFta} FT
              </td>
              <td className="gamecard-price">—</td>
              <td className={game.splitFtm > 0 ? 'gamecard-made' : 'gamecard-miss'}>
                {game.splitFtm > 0 ? `+${game.splitFtm}` : '0'}
              </td>
            </tr>
          )}
          {game.technicalFta > 0 && (
            <tr>
              <td />
              <td>
                technical free throws · {game.technicalFtm}/{game.technicalFta} FT
              </td>
              <td className="gamecard-price">—</td>
              <td className={game.technicalFtm > 0 ? 'gamecard-made' : 'gamecard-miss'}>
                {game.technicalFtm > 0 ? `+${game.technicalFtm}` : '0'}
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>game total</td>
            <td>{game.box.pts}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function GameCardPage({ slug, date }: { slug: string; date: string }) {
  const season = seasonOfGameDate(date)
  const state = useGameLogPayload(gameLogUrl(slug, season))
  const [receiptOpen, setReceiptOpen] = useState(false)
  const player = state.status === 'ready' ? state.payload._meta.player : slug
  useEffect(() => {
    document.title = `${player} · ${formatGameDate(date)} · game card`
  }, [player, date])

  if (state.status === 'loading') {
    return <Shell>{null}</Shell>
  }
  if (state.status === 'error') {
    return (
      <Shell>
        <p className="page-status page-error">
          {state.message}. <a href={gameLandingUrl()}>Back to game cards.</a>
        </p>
      </Shell>
    )
  }
  const payload: GameLogPayload = state.payload
  const index = payload.games.findIndex((g) => g.date === date)
  if (index === -1) {
    return (
      <Shell>
        <p className="page-status page-error">
          No {payload._meta.player} game on {formatGameDate(date)}.{' '}
          <a href={gameCardUrl(slug, payload._meta.dataThrough)}>His latest game card</a> or{' '}
          <a href={gameLandingUrl()}>all game cards</a>.
        </p>
      </Shell>
    )
  }
  const game = payload.games[index]!
  const numbers = computeGameCard(game, payload)
  const conversion = numbers.scoredPts - numbers.expectedPts
  const ftaRate = game.box.fta / game.shots.length
  const receiptLines =
    game.shots.length +
    game.trips.length +
    (game.splitFta > 0 ? 1 : 0) +
    (game.technicalFta > 0 ? 1 : 0)
  const prev = payload.games[index - 1]
  const next = payload.games[index + 1]
  const hero = heroBySlug(slug)
  const makes = numbers.assisted + numbers.unassisted + numbers.unknownMakes

  return (
    <Shell>
      <header className="gamecard-header">
        <p className="section-kicker">
          GAME CARD · {payload._meta.season} · {formatGameDate(game.date)}
        </p>
        <h1>{payload._meta.player}</h1>
        <p className="gamecard-sub">
          {game.home ? 'vs' : '@'} {game.opponent} · {game.box.pts} pts / {game.box.reb} reb /{' '}
          {game.box.ast} ast
          {hero !== undefined && (
            <>
              {' · '}
              <a href={heroPageUrl(hero)}>his season argument</a>
            </>
          )}
        </p>
      </header>

      <section className="gamecard-poster" aria-label="The night, priced">
        <div className="gamecard-numbers">
          <div>
            <em>{numbers.expectedPts.toFixed(1)}</em>
            <span>
              expected from his <Term id="shot-diet">diet</Term>
            </span>
            <small>
              {numbers.pricedAttempts} attempts at league rates
              {numbers.unpricedAttempts > 0 && ` · ${numbers.unpricedAttempts} outside pricing`}
            </small>
          </div>
          <div>
            <em>{numbers.scoredPts}</em>
            <span>scored on those attempts</span>
            <small>the league diet prices them {numbers.leagueExpectedPts.toFixed(1)}</small>
          </div>
          <div className={conversion >= 0 ? 'gamecard-warm' : 'gamecard-cool'}>
            <em>{signed(conversion)}</em>
            <span>conversion vs his diet</span>
            <small>points above expected</small>
          </div>
        </div>
        <div className="gamecard-chips">
          <p>
            <b>THE LINE</b> {numbers.tripPts} pts on {numbers.tripCount}{' '}
            <Term id="trip">trips</Term>
            {numbers.tripCount > 0 && ` (lg ${numbers.tripExpectedPts.toFixed(1)})`} ·{' '}
            {game.box.ftm}/{game.box.fta} FT ·{' '}
            <Term id="fta-rate">FTA rate</Term> {formatPercent1(ftaRate)}
          </p>
          <p>
            <b>THE CREDIT</b> {numbers.assisted} assisted · {numbers.unassisted} unassisted
            {numbers.unknownMakes > 0 && ` · ${numbers.unknownMakes} unknown`}
            {makes === 0 && ' · no makes'}
          </p>
        </div>
        <button
          type="button"
          className="gamecard-drill"
          aria-expanded={receiptOpen}
          onClick={() => setReceiptOpen(!receiptOpen)}
        >
          {receiptOpen ? 'close the receipt' : `the night in game order (${receiptLines} lines)`}
        </button>
        {receiptOpen && <Receipt game={game} numbers={numbers} />}
      </section>

      <p className="gamecard-stance">
        Shots priced at {payload._meta.season} league rates by zone, trips at the league's
        free-throw conversion. Conversion is this game's result, not an ability estimate.
      </p>

      <nav className="gamecard-nav" aria-label="Game to game">
        {prev !== undefined ? (
          <a href={gameCardUrl(slug, prev.date)}>← {formatGameDate(prev.date)}</a>
        ) : (
          <span />
        )}
        <a href={gameLandingUrl()}>all game cards</a>
        {next !== undefined ? (
          <a href={gameCardUrl(slug, next.date)}>{formatGameDate(next.date)} →</a>
        ) : (
          <span />
        )}
      </nav>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="gamecard-page">
        <SiteNav />
        {children}
      </main>
      <SiteFooter directoryLink />
    </>
  )
}
