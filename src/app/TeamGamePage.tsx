// One game row expanded (ADR-0084): the box team line as exact facts, the
// headline pair over that game's rows with its sample stated, zone COUNTS
// (no shading — no zone clears fifteen attempts in one game), and everyone
// who attempted a field goal. No comparison to other games, no trend, no
// note about why. The season comes off the game id, so the page fetches the
// same two team contracts the season page does.

import { useEffect, useMemo } from 'react'
import { aggregateTeam, seasonOfGameId } from '../domain/aggregateTeam'
import type { TeamGameRow } from '../domain/aggregateTeam'
import type { LedgerFacts } from '../domain/ledgerFacts'
import type { TeamShotPayload } from '../domain/teamShotPayload'
import { formatGameDate, formatMatchup } from '../format'
import { TEAM_COPY } from '../teams/copy'
import type { TeamConfig } from '../teams/registry'
import { ledgerFactsUrl, teamPageUrl, teamSeasonUrl, teamShotPayloadUrl } from '../teams/urls'
import { HeadlineBanner } from './HeadlineBanner'
import { TEAM_SUBJECT } from './headlineSubject'
import { SiteFooter } from './SiteFooter'
import { SiteNav } from './SiteNav'
import { TeamPageError } from './TeamPage'
import { useLedgerFacts, useTeamShotPayload } from './usePayload'

export function TeamGamePage({ team, gameId }: { team: TeamConfig; gameId: string }) {
  const season = seasonOfGameId(gameId)
  const known = team.seasons.includes(season)
  const payloadState = useTeamShotPayload(known ? teamShotPayloadUrl(team, season) : '')
  const ledgerState = useLedgerFacts(known ? ledgerFactsUrl(team, season) : '')

  useEffect(() => {
    document.title = `${team.name} · game ${gameId}`
  }, [team, gameId])

  if (!known) {
    return <TeamPageError message={`No ${team.name} season on file for game ${gameId}.`} />
  }
  if (payloadState.status === 'error') return <TeamPageError message={payloadState.message} />
  if (ledgerState.status === 'error') return <TeamPageError message={ledgerState.message} />
  if (payloadState.status === 'loading' || ledgerState.status === 'loading') {
    return (
      <main className="hero-page team-page">
        <SiteNav />
        <p className="page-status page-loading">Loading game data…</p>
      </main>
    )
  }
  return (
    <GameReady
      team={team}
      season={season}
      gameId={gameId}
      payload={payloadState.payload}
      ledger={ledgerState.payload}
    />
  )
}

function GameReady({
  team,
  season,
  gameId,
  payload,
  ledger,
}: {
  team: TeamConfig
  season: string
  gameId: string
  payload: TeamShotPayload
  ledger: LedgerFacts
}) {
  const metrics = useMemo(() => aggregateTeam(payload, ledger), [payload, ledger])
  const row = metrics.gameById.get(gameId)
  if (row === undefined) {
    return (
      <TeamPageError message={`Game ${gameId} is not in the ${team.name} ${season} ledger.`} />
    )
  }
  const seasonUrl = season === team.canonicalSeason ? teamPageUrl(team) : teamSeasonUrl(team, season)
  return (
    <>
      <main className="hero-page team-page team-game-page">
        <SiteNav />
        <header className="team-header">
          <p className="hero-kicker">
            {team.name} · {formatGameDate(row.gameDate)}
          </p>
          <h1 className="team-title">
            {formatMatchup(row.opponent, row.home)} · {row.won ? 'W' : 'L'} {row.teamScore}–
            {row.opponentScore}
          </h1>
          <p className="hero-byline">
            FG {row.fgm}–{row.fga} · FT {row.ftm}–{row.fta} · {row.shots} shots
            {row.thinSample ? '†' : ''} · vs {season} league average
          </p>
          <p className="team-note">
            <a href={seasonUrl}>← {TEAM_COPY.backToTeam(team.name)}</a>
          </p>
        </header>
        <HeadlineBanner
          selection={row.metrics.selection}
          making={row.metrics.making}
          subject={TEAM_SUBJECT}
        />
        <p className="team-note">
          {TEAM_COPY.gameNote}
          {row.thinSample ? ` ${TEAM_COPY.ledgerThinNote}` : ''}
        </p>
        <section className="team-game-section" aria-labelledby="team-game-zones">
          <header className="section-caption">
            <h2 id="team-game-zones">{TEAM_COPY.gameZonesCaption}</h2>
            <p className="section-caption-desc">{TEAM_COPY.gameZonesDesc}</p>
          </header>
          <ZoneCounts row={row} />
        </section>
        <section className="team-game-section" aria-labelledby="team-game-players">
          <header className="section-caption">
            <h2 id="team-game-players">{TEAM_COPY.gamePlayersCaption}</h2>
            <p className="section-caption-desc">{TEAM_COPY.gamePlayersDesc}</p>
          </header>
          <PlayerLines row={row} />
        </section>
      </main>
      <SiteFooter directoryLink />
    </>
  )
}

function ZoneCounts({ row }: { row: TeamGameRow }) {
  const { zones, backcourt } = row.metrics
  return (
    <div className="table-panel">
      <div className="zone-scroll">
        <table className="zone-table team-game-table" aria-label="Attempts and makes per zone in this game">
          <thead>
            <tr>
              <th scope="col">Zone</th>
              <th scope="col">FGA</th>
              <th scope="col">FGM</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.zone}>
                <th scope="row">{z.zone}</th>
                <td>{z.attempts}</td>
                <td>{z.makes}</td>
              </tr>
            ))}
            {backcourt.attempts > 0 && (
              <tr>
                <th scope="row">Backcourt</th>
                <td>{backcourt.attempts}</td>
                <td>{backcourt.makes}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PlayerLines({ row }: { row: TeamGameRow }) {
  return (
    <div className="table-panel">
      <div className="zone-scroll">
        <table className="zone-table team-game-table" aria-label="Field-goal shooters in this game">
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">FG</th>
              <th scope="col">FT</th>
              <th scope="col">PTS</th>
            </tr>
          </thead>
          <tbody>
            {row.players.map((p) => (
              <tr key={p.playerId}>
                <th scope="row">{p.playerName}</th>
                <td>
                  {p.fgm}–{p.fga}
                </td>
                <td>
                  {p.ftm}–{p.fta}
                </td>
                <td>{p.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
